import fs from "fs";
import path from "path";
import crypto from "crypto";
import { MongoClient } from "mongodb";


const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://<username>:<password>@cluster0.dr8kqbb.mongodb.net/?appName=Cluster0";
const DB_NAME = "cultural_events";
const COLLECTION_NAME = "RAW";

const API_URL =
  "https://public.opendatasoft.com/api/records/1.0/search/?dataset=evenements-publics-openagenda&rows=300";

async function collectAndStore() {
  const client = new MongoClient(MONGO_URI);
  try {
    await client.connect();
    const db = client.db(DB_NAME);
    const collection = db.collection(COLLECTION_NAME);

    const response = await fetch(API_URL, { signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`HTTP error ${response.status}`);
    const text = await response.text();
    const payload = JSON.parse(text);


    const hash = crypto.createHash("sha256").update(text).digest("hex");


    const exists = await collection.findOne({ raw_hash: hash });
    if (exists) {
      console.log("⚠️  This payload already exists in RAW, skipping insert.");
      return;
    }

    const rawDoc = {
      source: "openagenda_api",
      fetched_at: new Date().toISOString(),
      raw_hash: hash,
      payload: payload,
    };

    const result = await collection.insertOne(rawDoc);
    console.log("Inserted RAW document", result.insertedId);

  } catch (error) {
    console.error("Collection/Storage failed", error.message);
  } finally {
    await client.close();
  }
}

collectAndStore();

