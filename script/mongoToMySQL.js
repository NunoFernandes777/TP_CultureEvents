import { MongoClient } from "mongodb";
import mysql from "mysql2/promise";

const MONGO_URI =
  process.env.MONGO_URI ||
  "mongodb+srv://pedronunof:malucaarmafe@cluster0.dr8kqbb.mongodb.net/?appName=Cluster0";
const MONGO_DB = process.env.MONGO_DB || "cultural_events";
const MONGO_COLLECTION = process.env.MONGO_COLLECTION || "ENRICHED";

const MYSQL_CONFIG = {
  host: process.env.MYSQL_HOST ?? "127.0.0.1",
  user: process.env.MYSQL_USER ?? "root",
  password: process.env.MYSQL_PASSWORD ?? "",
  database: process.env.MYSQL_DATABASE ?? "cultural_events",
  port: Number(process.env.MYSQL_PORT || 3306),
};

function pick(obj, keys, fallback = null) {
  for (const key of keys) {
    const value = obj?.[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return fallback;
}

async function transferEnrichedToMySQL() {
  const mongo = new MongoClient(MONGO_URI);
  const sql = await mysql.createConnection(MYSQL_CONFIG);

  try {
    await mongo.connect();

    const collection = mongo.db(MONGO_DB).collection(MONGO_COLLECTION);
    const docs = await collection.find({}).toArray();

    let insertedEvents = 0;

    for (const doc of docs) {
      const data = doc.data || {};

      const uid = String(
        pick(data, ["uid", "event_uid", "id"], doc._id?.toString() || "")
      );
      const title = pick(data, ["title_fr", "title"], null);
      const description = pick(data, ["description_fr", "description"], null);
      const eventDate = pick(data, ["event_date", "date_start", "date"], null);
      const city = pick(data, ["location_city", "city"], "Unknown city");
      const country = pick(data, ["country_fr", "country"], "Unknown country");
      const address = pick(data, ["location_address", "address"], "");

      if (!uid || !title) continue;

      const [locResult] = await sql.execute(
        `
        INSERT INTO locations (city, country, address)
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)
        `,
        [city, country, address]
      );

      const locationId = locResult.insertId;

      const [eventResult] = await sql.execute(
        `
        INSERT INTO events (uid, title, description, event_date, location_id)
        VALUES (?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          title = VALUES(title),
          description = VALUES(description),
          event_date = VALUES(event_date),
          location_id = VALUES(location_id)
        `,
        [uid, title, description, eventDate, locationId]
      );

      if (eventResult.affectedRows > 0) insertedEvents += 1;
    }

    console.log(
      `Transfer complete: processed=${docs.length}, upserted_events=${insertedEvents}`
    );
  } finally {
    await mongo.close();
    await sql.end();
  }
}

transferEnrichedToMySQL().catch((error) => {
  console.error("Transfer failed:", error.message);
  process.exit(1);
});
