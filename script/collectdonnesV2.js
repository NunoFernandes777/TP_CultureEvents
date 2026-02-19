import fs from "fs";
import path from "path";

const API_URL =
  "https://public.opendatasoft.com/api/records/1.0/search/?dataset=evenements-publics-openagenda&rows=500";

const DATA_DIR = path.resolve("./data");
const OUTPUT_FILE = path.join(DATA_DIR, "raw-events-v2.json");

function pickFirst(obj, keys, fallback = null) {
  for (const key of keys) {
    const value = obj?.[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return fallback;
}

function normalizeString(value) {
  if (value === undefined || value === null) return null;
  const s = String(value).trim();
  return s.length ? s : null;
}

function inferCityFromAddress(address) {
  if (!address) return null;
  const s = String(address).replace(/\s+/g, " ").trim();

  // Examples handled: "... 33000 Bordeaux", "... 26140 Saint-Rambert-d'Albon, France"
  const postalPattern = /\b\d{5}\s+([A-Za-zÀ-ÖØ-öø-ÿ' -]{2,})(?:,|$)/u;
  const withPostal = s.match(postalPattern);
  if (withPostal?.[1]) return normalizeString(withPostal[1]);

  // Fallback: last comma-separated segment.
  const parts = s.split(",").map((x) => x.trim()).filter(Boolean);
  if (parts.length > 0) {
    const candidate = normalizeString(parts[parts.length - 1]);
    const banned = new Set(["france", "france (metropole)", "metropole"]);
    if (candidate && !banned.has(candidate.toLowerCase())) return candidate;
  }

  return null;
}

async function collectV2() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

    const response = await fetch(API_URL, { signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw new Error(`HTTP error ${response.status}`);

    const payload = await response.json();
    const records = Array.isArray(payload.records) ? payload.records : [];

    const rawEventsV2 = records.map((record) => {
      const f = record?.fields || {};

      const title = pickFirst(f, ["title_fr", "title"], null);
      const description = pickFirst(f, ["description_fr", "description"], null);
      const conditions = pickFirst(f, ["conditions_fr", "conditions"], null);
      const address = pickFirst(f, ["location_address", "address"], null);
      const city =
        pickFirst(f, ["location_city", "city"], null) ??
        inferCityFromAddress(address) ??
        inferCityFromAddress(pickFirst(f, ["location_name", "venue"], null));
      const country = pickFirst(f, ["country_fr", "country"], null);

      return {
        source: "openagenda_api",
        fetched_at: new Date().toISOString(),
        record_id: normalizeString(record?.recordid),
        dataset_id: normalizeString(record?.datasetid),
        uid: normalizeString(f.uid),
        title_fr: normalizeString(title),
        description_fr: normalizeString(description),
        conditions_fr: normalizeString(conditions),
        location_name: normalizeString(pickFirst(f, ["location_name", "venue"], null)),
        location_address: normalizeString(address),
        location_city: normalizeString(city),
        country_fr: normalizeString(country),
        event_date: normalizeString(
          pickFirst(f, ["event_date", "date_start", "firstdate_begin"], null)
        ),
        date_start: normalizeString(pickFirst(f, ["date_start", "firstdate_begin"], null)),
        date_end: normalizeString(pickFirst(f, ["date_end", "firstdate_end"], null)),
        date_text: normalizeString(
          pickFirst(f, ["daterange_fr", "date_description", "date_text"], null)
        ),
        coordinates_raw: pickFirst(
          f,
          ["location_coordinates", "location_geometry", "geo_point_2d", "latlon"],
          null
        ),
        tags_raw: pickFirst(f, ["keywords_fr", "tags", "theme"], null),
        raw_fields: f,
      };
    });

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(rawEventsV2, null, 2), "utf-8");

    console.log(`Raw V2 collected: ${rawEventsV2.length} records`);
    console.log(`Output: ${OUTPUT_FILE}`);
    console.log("First 2 records:", rawEventsV2.slice(0, 2));
  } catch (error) {
    console.error("Collection V2 failed:", error.message);
    process.exit(1);
  }
}

collectV2();
