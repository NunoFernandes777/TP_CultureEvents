import fs from "fs";
import path from "path";

const API_URL =
  "https://public.opendatasoft.com/api/records/1.0/search/?dataset=evenements-publics-openagenda&rows=300";

const DATA_DIR = path.resolve("./data");
const OUTPUT_FILE = path.join(DATA_DIR, "raw-events.json");

async function collect() {
  try {
 
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
 
    const response = await fetch(API_URL, { signal: AbortSignal.timeout(15000) });

    if (!response.ok) throw new Error(`HTTP error ${response.status}`);

    const text = await response.text();

    const json = JSON.parse(text);
  
    const filtered = json.records.map((record) => {
      const f = record.fields || {};
      return {
        uid: f.uid || null,
        title_fr: f.title_fr || null,
        description_fr: f.description_fr || null,
        conditions_fr: f.conditions_fr || null,
        location_name: f.location_name || null,
        location_address: f.location_address || null,
        country_fr: f.country_fr || null,
        location_city: f.location_city || null,
      };
    });

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(filtered, null, 2), "utf-8");

    console.log("Data collected");
    console.log(`Total records: ${filtered.length}`);
    console.log("First 3 records:", filtered.slice(0, 3));
  } catch (error) {
    console.error("Collection failed:", error.message);
    process.exit(1);
  }
}

collect();
