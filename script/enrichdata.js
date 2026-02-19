import { MongoClient, ObjectId } from "mongodb";

const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://<username>:<password>@cluster0.dr8kqbb.mongodb.net/?appName=Cluster0";
const DB_NAME = "cultural_events";

function categorizeEvent(text = "") {
  const t = text.toLowerCase();
  if (t.includes("concert") || t.includes("musique")) return "music";
  if (t.includes("exposition") || t.includes("musée")) return "exhibition";
  if (t.includes("théâtre")) return "theater";
  if (t.includes("atelier")) return "workshop";
  return "other";
}

function geocode(city) {
  if (city === "Paris") return { lat: 48.8566, lon: 2.3522 };
  return null;
}

async function enrich() {
  const client = new MongoClient(MONGO_URI);
  await client.connect();

  const db = client.db(DB_NAME);
  const rawCol = db.collection("RAW");
  const enrichedCol = db.collection("ENRICHED");

  const raws = await rawCol.find().toArray();

  for (const raw of raws) {
    try {
      const records = raw.payload.records || [];

      for (const r of records) {
        const f = r.fields;

        if (!f?.title_fr || !f?.location_city) {
            await enrichedCol.insertOne({
                raw_id: raw._id,
                status: "failed",
                enriched_at: new Date().toISOString(),
                error: {
                    code: "MISSING_FIELDS",
                    message: "title_fr or location_city is missing"
                    }
                });
            continue;
        }

        const category = categorizeEvent(f.title_fr);
        const geo = geocode(f.location_city);

        const enrichedDoc = {
          raw_id: raw._id,
          status: "success",
          enriched_at: new Date().toISOString(),
          data: {
            title: f.title_fr,
            city: f.location_city,
            category,
            geo
          }
        };

        await enrichedCol.insertOne(enrichedDoc);
      }

    } catch (err) {
      await enrichedCol.insertOne({
        raw_id: raw._id,
        status: "failed",
        enriched_at: new Date().toISOString(),
        error: {
          code: "ENRICHMENT_ERROR",
          message: err.message
        }
      });
    }
  }

  console.log("Enrichment finished");
  await client.close();
}

enrich();

