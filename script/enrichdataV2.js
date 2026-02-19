import fs from "fs";
import path from "path";
import mysql from "mysql2/promise";
import { categorizeText, normalizeText } from "../lib/etl.js";

const DATA_DIR = path.resolve("./data");
const INPUT_FILE = path.join(DATA_DIR, "raw-events-v2.json");
const OUTPUT_FILE = path.join(DATA_DIR, "enriched-events-v2.json");

const MYSQL_CONFIG = {
  host: process.env.MYSQL_HOST ?? "127.0.0.1",
  user: process.env.MYSQL_USER ?? "root",
  password: process.env.MYSQL_PASSWORD ?? "",
  database: process.env.MYSQL_DATABASE ?? "cultural_events",
  port: Number(process.env.MYSQL_PORT || 3306),
};

const CATEGORY_LABEL_FR = {
  music: "Musique",
  exhibition: "Exposition",
  theater: "Theatre",
  workshop: "Atelier",
  conference: "Conference",
  festival: "Festival",
  cinema: "Cinema",
  dance: "Danse",
  heritage: "Patrimoine",
  kids: "Jeune public",
  other: "Autre",
};

const CITY_COORDINATES = {
  paris: { lat: 48.8566, lon: 2.3522 },
  lyon: { lat: 45.764, lon: 4.8357 },
  marseille: { lat: 43.2965, lon: 5.3698 },
  bordeaux: { lat: 44.8378, lon: -0.5792 },
  toulouse: { lat: 43.6047, lon: 1.4442 },
  nantes: { lat: 47.2184, lon: -1.5536 },
  strasbourg: { lat: 48.5734, lon: 7.7521 },
  montpellier: { lat: 43.611, lon: 3.8767 },
  lille: { lat: 50.6292, lon: 3.0573 },
  rennes: { lat: 48.1173, lon: -1.6778 },
  versailles: { lat: 48.8049, lon: 2.1204 },
  begles: { lat: 44.8076, lon: -0.5513 },
  "le mans": { lat: 48.0061, lon: 0.1996 },
};

const SKILL_RULES = {
  communication: ["communication", "presenter", "presentation", "debate", "conference"],
  pedagogie: ["atelier", "workshop", "formation", "apprentissage", "initiation"],
  gestion_projet: ["organisation", "coordination", "planning", "projet"],
  creativite: ["creation", "creatif", "artistique", "impro", "design"],
  musique: ["concert", "musique", "jazz", "rock", "rap", "acoustique"],
  theatre: ["theatre", "theater", "comedie", "drama", "scene", "spectacle"],
  danse: ["danse", "choregraphie", "choregraphy", "performance corporelle"],
  photographie: ["photo", "photographie", "camera", "portrait", "exposition photo"],
  bricolage: ["bricolage", "outil", "jardinage", "diy", "reparation"],
  numerique: ["numerique", "digital", "code", "programmation", "informatique"],
  langues: ["anglais", "french", "francais", "traduction", "bilingue"],
};

function pickFirst(obj, keys, fallback = null) {
  for (const key of keys) {
    const value = obj?.[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return fallback;
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (value === null || value === undefined || value === "") return [];
  if (typeof value === "string") {
    return value
      .split(/[,;|]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [value];
}

function parseNumber(value) {
  if (value === null || value === undefined) return null;
  const n = Number(String(value).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function parseCoordinatesFromRaw(raw) {
  if (!raw) return null;

  if (Array.isArray(raw) && raw.length >= 2) {
    const a = parseNumber(raw[0]);
    const b = parseNumber(raw[1]);
    if (a === null || b === null) return null;
    if (Math.abs(a) <= 90 && Math.abs(b) <= 180) return { lat: a, lon: b };
    if (Math.abs(a) <= 180 && Math.abs(b) <= 90) return { lat: b, lon: a };
  }

  if (typeof raw === "object") {
    const lat = parseNumber(raw.lat ?? raw.latitude ?? raw.y);
    const lon = parseNumber(raw.lon ?? raw.lng ?? raw.longitude ?? raw.x);
    if (lat !== null && lon !== null) return { lat, lon };
    if (Array.isArray(raw.coordinates) && raw.coordinates.length >= 2) {
      const lon2 = parseNumber(raw.coordinates[0]);
      const lat2 = parseNumber(raw.coordinates[1]);
      if (lat2 !== null && lon2 !== null) return { lat: lat2, lon: lon2 };
    }
  }

  if (typeof raw === "string") {
    const m = raw.match(/(-?\d+(?:[.,]\d+)?)\s*[,; ]\s*(-?\d+(?:[.,]\d+)?)/);
    if (!m) return null;
    const a = parseNumber(m[1]);
    const b = parseNumber(m[2]);
    if (a === null || b === null) return null;
    if (Math.abs(a) <= 90 && Math.abs(b) <= 180) return { lat: a, lon: b };
    if (Math.abs(a) <= 180 && Math.abs(b) <= 90) return { lat: b, lon: a };
  }

  return null;
}

function geocodeFromAddressOrCity(address, city, rawCoordinates) {
  const parsed = parseCoordinatesFromRaw(rawCoordinates);
  if (parsed) return { ...parsed, geocode_source: "api_coordinates" };

  const normalizedCity = normalizeText(city || "").trim();
  if (normalizedCity && CITY_COORDINATES[normalizedCity]) {
    return { ...CITY_COORDINATES[normalizedCity], geocode_source: "city_dictionary" };
  }

  const normalizedAddress = normalizeText(address || "");
  const cityEntry = Object.entries(CITY_COORDINATES).find(([name]) =>
    normalizedAddress.includes(name)
  );
  if (cityEntry) {
    return { ...cityEntry[1], geocode_source: "address_dictionary" };
  }

  return null;
}

function normalizeDateValue(value) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }
  const d = new Date(value);
  if (!Number.isNaN(d.getTime())) return d.toISOString();
  return null;
}

function normalizeDates(event) {
  const fields = event.raw_fields || {};
  const startRaw =
    pickFirst(event, ["date_start", "event_date"], null) ??
    pickFirst(fields, ["date_start", "firstdate_begin", "event_date"], null);
  const endRaw =
    pickFirst(event, ["date_end"], null) ??
    pickFirst(fields, ["date_end", "firstdate_end"], null);

  let startIso = normalizeDateValue(startRaw);
  let endIso = normalizeDateValue(endRaw);

  if (startIso && !endIso) endIso = startIso;
  if (startIso && endIso && endIso < startIso) {
    const tmp = startIso;
    startIso = endIso;
    endIso = tmp;
  }

  return {
    start_at_iso: startIso,
    end_at_iso: endIso,
    raw_date_text: event.date_text ?? null,
  };
}

function normalizePricingFromText(text) {
  const sourceText = String(text || "");
  if (!sourceText.trim()) {
    return {
      is_free: null,
      amount_min: null,
      amount_max: null,
      currency: null,
      source_text: null,
    };
  }

  const t = normalizeText(sourceText);
  const isFree =
    t.includes("gratuit") || t.includes("free") || t.includes("entree libre");

  const values = [];
  const regex = /(\d+(?:[.,]\d+)?)\s*(?:€|eur|euro|euros)\b/gi;
  let match;
  while ((match = regex.exec(sourceText)) !== null) {
    const amount = parseNumber(match[1]);
    if (amount !== null) values.push(amount);
  }

  return {
    is_free: values.length ? false : isFree,
    amount_min: values.length ? Math.min(...values) : null,
    amount_max: values.length ? Math.max(...values) : null,
    currency: values.length ? "EUR" : null,
    source_text: sourceText,
  };
}

function extractSkillsFromText(text) {
  const normalized = normalizeText(text || "");
  const skills = [];

  for (const [skill, keywords] of Object.entries(SKILL_RULES)) {
    if (keywords.some((k) => normalized.includes(normalizeText(k)))) {
      skills.push(skill);
    }
  }

  return skills.sort();
}

function computeInternalScore(enriched) {
  let score = 0;
  const reasons = [];

  if (enriched.title_fr) {
    score += 20;
    reasons.push("title");
  }
  if (enriched.description_fr) {
    score += 15;
    reasons.push("description");
  }
  if (enriched.category && enriched.category !== "other") {
    score += 15;
    reasons.push("categorized");
  }
  if (enriched.geo) {
    score += 20;
    reasons.push("geocoded");
  }
  if (enriched.normalized_dates.start_at_iso) {
    score += 15;
    reasons.push("date_normalized");
  }
  if ((enriched.skills || []).length > 0) {
    score += 10;
    reasons.push("skills_extracted");
  }
  if (
    enriched.normalized_pricing.is_free !== null ||
    enriched.normalized_pricing.amount_min !== null
  ) {
    score += 5;
    reasons.push("pricing_normalized");
  }

  return { value: Math.min(score, 100), reasons };
}

function toMySqlDateTime(isoString) {
  if (!isoString) return null;
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 19).replace("T", " ");
}

function buildSqlRows(data) {
  const categoryCode = data.category || "other";
  return {
    locations: {
      city: data.location_city || "Unknown city",
      country: data.country_fr || "Unknown country",
      address: data.location_address || "",
    },
    events: {
      uid: String(data.uid || ""),
      title: data.title_fr || "",
      description: data.description_fr || null,
      event_date: toMySqlDateTime(data.normalized_dates?.start_at_iso),
    },
    event_types: {
      code: categoryCode,
      label_fr: CATEGORY_LABEL_FR[categoryCode] || "Autre",
      description: "Auto-classification V2",
    },
    events_event_types: {
      event_type_code: categoryCode,
      confidence_score: data.category && data.category !== "other" ? 0.85 : 0.5,
      source: "etl_v2",
    },
    event_schedules: {
      starts_at: toMySqlDateTime(data.normalized_dates?.start_at_iso),
      ends_at: toMySqlDateTime(data.normalized_dates?.end_at_iso),
      timezone: "Europe/Paris",
      is_all_day: 0,
      source_date_text: data.raw_date_text || null,
    },
    event_pricing: {
      ticket_label: data.normalized_pricing?.is_free ? "Gratuit" : "Standard",
      amount: data.normalized_pricing?.amount_min ?? null,
      currency: data.normalized_pricing?.currency || "EUR",
      is_free: data.normalized_pricing?.is_free ? 1 : 0,
      conditions_text: data.conditions_fr || null,
    },
  };
}

function enrichEvent(event) {
  const tags = asArray(event.tags_raw);
  const text = [
    event.title_fr,
    event.description_fr,
    event.conditions_fr,
    event.raw_fields?.longdescription_fr,
    tags.join(" "),
  ]
    .filter(Boolean)
    .join(" ");

  const geo = geocodeFromAddressOrCity(
    event.location_address,
    event.location_city,
    event.coordinates_raw
  );
  const normalizedDates = normalizeDates(event);
  const normalizedPricing = normalizePricingFromText(event.conditions_fr);
  const skills = extractSkillsFromText(text);
  const category = categorizeText(text);

  const data = {
    uid: event.uid ?? null,
    source: event.source ?? "openagenda_api",
    fetched_at: event.fetched_at ?? null,
    title_fr: event.title_fr ?? null,
    description_fr: event.description_fr ?? null,
    conditions_fr: event.conditions_fr ?? null,
    location_name: event.location_name ?? null,
    location_address: event.location_address ?? null,
    location_city: event.location_city ?? null,
    country_fr: event.country_fr ?? null,
    geo,
    category,
    skills,
    normalized_dates: normalizedDates,
    normalized_pricing: normalizedPricing,
    tags,
    raw_date_text: event.date_text ?? null,
  };

  const qualityFlags = [];
  if (!data.uid) qualityFlags.push("missing_uid");
  if (!data.title_fr) qualityFlags.push("missing_title");
  if (!data.location_city) qualityFlags.push("missing_city");
  if (!data.geo) qualityFlags.push("missing_geo");
  if (!data.normalized_dates.start_at_iso) qualityFlags.push("missing_date");
  if (skills.length === 0) qualityFlags.push("no_skills_detected");

  const internalScore = computeInternalScore(data);

  return {
    status:
      qualityFlags.includes("missing_uid") ||
      qualityFlags.includes("missing_title") ||
      qualityFlags.includes("missing_city")
        ? "failed"
        : "success",
    quality_flags: qualityFlags,
    internal_score: internalScore,
    data,
    sql_rows: buildSqlRows(data),
  };
}

async function syncToMySQL(enrichedRecords) {
  const sql = await mysql.createConnection(MYSQL_CONFIG);
  const locationCache = new Map();
  const eventTypeCache = new Map();

  let eligible = 0;
  let synced = 0;

  try {
    const [ticketLabelCols] = await sql.execute(
      `SHOW COLUMNS FROM event_pricing LIKE 'ticket_label'`
    );
    const [ticketTypeIdCols] = await sql.execute(
      `SHOW COLUMNS FROM event_pricing LIKE 'ticket_type_id'`
    );
    const hasTicketLabel = Array.isArray(ticketLabelCols) && ticketLabelCols.length > 0;
    const hasTicketTypeId =
      Array.isArray(ticketTypeIdCols) && ticketTypeIdCols.length > 0;

    for (const item of enrichedRecords) {
      if (item.status !== "success") continue;
      const rows = item.sql_rows || {};
      const eventRow = rows.events || {};
      const locationRow = rows.locations || {};
      if (!eventRow.uid || !eventRow.title || !locationRow.city) continue;

      eligible += 1;

      const locKey = `${locationRow.city}|${locationRow.country}|${locationRow.address}`;
      let locationId = locationCache.get(locKey);
      if (!locationId) {
        const [locRes] = await sql.execute(
          `
          INSERT INTO locations (city, country, address)
          VALUES (?, ?, ?)
          ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)
          `,
          [locationRow.city, locationRow.country, locationRow.address]
        );
        locationId = locRes.insertId;
        locationCache.set(locKey, locationId);
      }

      const [eventRes] = await sql.execute(
        `
        INSERT INTO events (uid, title, description, event_date, location_id)
        VALUES (?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          id = LAST_INSERT_ID(id),
          title = VALUES(title),
          description = VALUES(description),
          event_date = VALUES(event_date),
          location_id = VALUES(location_id)
        `,
        [
          eventRow.uid,
          eventRow.title,
          eventRow.description,
          eventRow.event_date,
          locationId,
        ]
      );
      const eventId = eventRes.insertId;

      const typeRow = rows.event_types || {};
      const typeCode = typeRow.code || "other";
      let eventTypeId = eventTypeCache.get(typeCode);
      if (!eventTypeId) {
        const [typeRes] = await sql.execute(
          `
          INSERT INTO event_types (code, label_fr, description)
          VALUES (?, ?, ?)
          ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)
          `,
          [typeCode, typeRow.label_fr || "Autre", typeRow.description || null]
        );
        eventTypeId = typeRes.insertId;
        eventTypeCache.set(typeCode, eventTypeId);
      }

      const bridgeRow = rows.events_event_types || {};
      await sql.execute(
        `
        INSERT INTO events_event_types (event_id, event_type_id, confidence_score, source)
        VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          confidence_score = VALUES(confidence_score),
          source = VALUES(source)
        `,
        [
          eventId,
          eventTypeId,
          bridgeRow.confidence_score ?? null,
          bridgeRow.source || "etl_v2",
        ]
      );

      await sql.execute(`DELETE FROM event_schedules WHERE event_id = ?`, [eventId]);
      const scheduleRow = rows.event_schedules || {};
      if (scheduleRow.starts_at || scheduleRow.ends_at || scheduleRow.source_date_text) {
        await sql.execute(
          `
          INSERT INTO event_schedules (
            event_id, starts_at, ends_at, timezone, is_all_day, source_date_text
          )
          VALUES (?, ?, ?, ?, ?, ?)
          `,
          [
            eventId,
            scheduleRow.starts_at,
            scheduleRow.ends_at,
            scheduleRow.timezone || "Europe/Paris",
            scheduleRow.is_all_day || 0,
            scheduleRow.source_date_text || null,
          ]
        );
      }

      await sql.execute(`DELETE FROM event_pricing WHERE event_id = ?`, [eventId]);
      const pricingRow = rows.event_pricing || {};
      if (
        pricingRow.conditions_text ||
        pricingRow.amount !== null ||
        pricingRow.is_free === 1
      ) {
        if (hasTicketLabel) {
          await sql.execute(
            `
            INSERT INTO event_pricing (
              event_id, ticket_label, amount, currency, is_free, conditions_text
            )
            VALUES (?, ?, ?, ?, ?, ?)
            `,
            [
              eventId,
              pricingRow.ticket_label || null,
              pricingRow.amount ?? null,
              pricingRow.currency || "EUR",
              pricingRow.is_free ? 1 : 0,
              pricingRow.conditions_text || null,
            ]
          );
        } else if (hasTicketTypeId) {
          await sql.execute(
            `
            INSERT INTO event_pricing (
              event_id, ticket_type_id, amount, currency, is_free, conditions_text
            )
            VALUES (?, NULL, ?, ?, ?, ?)
            `,
            [
              eventId,
              pricingRow.amount ?? null,
              pricingRow.currency || "EUR",
              pricingRow.is_free ? 1 : 0,
              pricingRow.conditions_text || null,
            ]
          );
        }
      }

      synced += 1;
    }

    console.log(`MySQL sync complete: eligible=${eligible}, synced=${synced}`);
  } finally {
    await sql.end();
  }
}

async function enrichV2() {
  try {
    if (!fs.existsSync(INPUT_FILE)) {
      throw new Error(`Input raw file not found: ${INPUT_FILE}`);
    }
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

    const raw = JSON.parse(fs.readFileSync(INPUT_FILE, "utf-8"));
    const records = Array.isArray(raw) ? raw : [];
    const enriched = records.map(enrichEvent);

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(enriched, null, 2), "utf-8");

    const successCount = enriched.filter((e) => e.status === "success").length;
    console.log(
      `Enriched V2 done: total=${enriched.length}, success=${successCount}, failed=${
        enriched.length - successCount
      }`
    );
    console.log(`Output: ${OUTPUT_FILE}`);

    const shouldSync =
      process.argv.includes("--sync-mysql") ||
      process.env.V2_SYNC_MYSQL === "1" ||
      process.env.V2_SYNC_MYSQL === "true";

    if (shouldSync) {
      await syncToMySQL(enriched);
    }
  } catch (error) {
    console.error("Enrichment V2 failed:", error.message);
    process.exit(1);
  }
}

enrichV2();
