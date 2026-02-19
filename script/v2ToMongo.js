import fs from "fs";
import path from "path";
import crypto from "crypto";
import { MongoClient } from "mongodb";

const DATA_DIR = path.resolve("./data");
const RAW_FILE = path.join(DATA_DIR, "raw-events-v2.json");
const ENRICHED_FILE = path.join(DATA_DIR, "enriched-events-v2.json");

const MONGO_URI =
  process.env.MONGO_URI ||
  "mongodb+srv://pedronunof:malucaarmafe@cluster0.dr8kqbb.mongodb.net/?appName=Cluster0";
const DB_NAME = process.env.MONGO_DB || "cultural_events";
const RAW_COLLECTION = process.env.MONGO_RAW_V2_COLLECTION || "RAW_V2";
const ENRICHED_COLLECTION =
  process.env.MONGO_ENRICHED_V2_COLLECTION || "ENRICHED_V2";

function readJsonArray(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing file: ${filePath}`);
  }
  const parsed = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  if (!Array.isArray(parsed)) {
    throw new Error(`Expected JSON array in: ${filePath}`);
  }
  return parsed;
}

function stableHash(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function rawDocKey(doc) {
  if (doc?.uid) return `uid:${doc.uid}`;
  if (doc?.record_id) return `record:${doc.record_id}`;
  return `hash:${stableHash(JSON.stringify(doc))}`;
}

function enrichedDocKey(doc) {
  const uid = doc?.data?.uid;
  if (uid) return `uid:${uid}`;
  const fallback = JSON.stringify({
    title: doc?.data?.title_fr || null,
    city: doc?.data?.location_city || null,
    start: doc?.data?.normalized_dates?.start_at_iso || null,
  });
  return `hash:${stableHash(fallback)}`;
}

async function uploadV2ToMongo() {
  const client = new MongoClient(MONGO_URI);
  try {
    const rawRecords = readJsonArray(RAW_FILE);
    const enrichedRecords = readJsonArray(ENRICHED_FILE);

    await client.connect();
    const db = client.db(DB_NAME);
    const rawCol = db.collection(RAW_COLLECTION);
    const enrichedCol = db.collection(ENRICHED_COLLECTION);

    await rawCol.createIndex({ source_key: 1 }, { unique: true });
    await enrichedCol.createIndex({ source_key: 1 }, { unique: true });

    const importedAt = new Date().toISOString();

    const rawOps = rawRecords.map((doc) => {
      const key = rawDocKey(doc);
      return {
        updateOne: {
          filter: { source_key: key },
          update: {
            $set: {
              source_key: key,
              source_file: "raw-events-v2.json",
              imported_at: importedAt,
              payload: doc,
            },
          },
          upsert: true,
        },
      };
    });

    const enrichedOps = enrichedRecords.map((doc) => {
      const key = enrichedDocKey(doc);
      return {
        updateOne: {
          filter: { source_key: key },
          update: {
            $set: {
              source_key: key,
              source_file: "enriched-events-v2.json",
              imported_at: importedAt,
              payload: doc,
            },
          },
          upsert: true,
        },
      };
    });

    const rawResult =
      rawOps.length > 0
        ? await rawCol.bulkWrite(rawOps, { ordered: false })
        : { upsertedCount: 0, modifiedCount: 0 };
    const enrichedResult =
      enrichedOps.length > 0
        ? await enrichedCol.bulkWrite(enrichedOps, { ordered: false })
        : { upsertedCount: 0, modifiedCount: 0 };

    console.log(
      `Mongo V2 upload complete: raw(upserted=${rawResult.upsertedCount}, modified=${rawResult.modifiedCount}), enriched(upserted=${enrichedResult.upsertedCount}, modified=${enrichedResult.modifiedCount})`
    );
    console.log(`DB: ${DB_NAME}`);
    console.log(`Collections: ${RAW_COLLECTION}, ${ENRICHED_COLLECTION}`);
  } catch (error) {
    console.error("Mongo V2 upload failed:", error.message);
    process.exit(1);
  } finally {
    await client.close();
  }
}

uploadV2ToMongo();
