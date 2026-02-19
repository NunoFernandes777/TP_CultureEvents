const CATEGORY_KEYWORDS = {
  music: [
    "concert",
    "musique",
    "music",
    "son",
    "acoustique",
    "acoustic",
    "jazz",
    "rock",
    "rap",
    "hip hop",
    "hip-hop",
    "electro",
    "electronic",
    "pop",
    "blues",
    "folk",
    "opera",
    "symphonie",
    "symphony",
    "philharmonique",
    "philharmonic",
    "dj",
    "set dj",
    "set live",
    "chorale",
    "choir",
    "orchestra",
    "orchestre",
    "festival",
    "recital",
    "live",
    "karaoke",
    "musician",
    "musicien",
  ],
  exhibition: [
    "exposition",
    "exhibit",
    "museum",
    "musee",
    "galerie",
    "gallery",
    "vernissage",
    "art",
    "arts visuels",
    "visual art",
    "peinture",
    "painting",
    "sculpture",
    "installation",
    "collection",
    "patrimoine",
    "heritage",
    "historique",
    "history",
    "photography",
    "photo",
    "dessin",
    "drawing",
  ],
  theater: [
    "theatre",
    "theater",
    "piece",
    "play",
    "scene",
    "comedie",
    "comedy",
    "drama",
    "spectacle",
    "stand-up",
    "stand up",
    "impro",
    "improv",
    "performance",
    "acteur",
    "actor",
    "actrice",
    "actress",
    "mise en scene",
    "one man show",
    "one woman show",
  ],
  workshop: [
    "atelier",
    "workshop",
    "masterclass",
    "formation",
    "training",
    "cours",
    "class",
    "initiation",
    "conference",
    "seminaire",
    "seminar",
    "table ronde",
    "roundtable",
    "rencontre",
    "discussion",
    "apprentissage",
    "learning",
    "stage",
    "bootcamp",
  ],
};

export function normalizeText(text = "") {
  return String(text)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function categorizeText(text = "") {
  const t = normalizeText(text);

  if (CATEGORY_KEYWORDS.music.some((word) => t.includes(word))) return "music";
  if (CATEGORY_KEYWORDS.exhibition.some((word) => t.includes(word))) {
    return "exhibition";
  }
  if (CATEGORY_KEYWORDS.theater.some((word) => t.includes(word))) return "theater";
  if (CATEGORY_KEYWORDS.workshop.some((word) => t.includes(word))) return "workshop";

  return "other";
}

export function parseRawPayload(payload = {}) {
  const records = Array.isArray(payload.records) ? payload.records : [];
  return records.map((record) => {
    const f = record?.fields || {};
    return {
      uid: f.uid ?? null,
      title_fr: f.title_fr ?? null,
      description_fr: f.description_fr ?? null,
      location_address: f.location_address ?? null,
      country_fr: f.country_fr ?? null,
      location_city: f.location_city ?? null,
      event_date: f.event_date ?? null,
    };
  });
}

export function enrichParsedRecord(parsedRecord = {}, rawId = null) {
  if (!parsedRecord.title_fr || !parsedRecord.location_city) {
    return {
      raw_id: rawId,
      status: "failed",
      error: {
        code: "MISSING_FIELDS",
        message: "title_fr or location_city is missing",
      },
    };
  }

  return {
    raw_id: rawId,
    status: "success",
    data: {
      uid: parsedRecord.uid ?? null,
      title_fr: parsedRecord.title_fr,
      description_fr: parsedRecord.description_fr ?? null,
      location_city: parsedRecord.location_city,
      country_fr: parsedRecord.country_fr ?? null,
      location_address: parsedRecord.location_address ?? null,
      event_date: parsedRecord.event_date ?? null,
      category: categorizeText(
        `${parsedRecord.title_fr ?? ""} ${parsedRecord.description_fr ?? ""}`
      ),
    },
  };
}

function pick(obj, keys, fallback = null) {
  for (const key of keys) {
    const value = obj?.[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return fallback;
}

export function mapEnrichedToSqlRow(enrichedDoc = {}) {
  const data = enrichedDoc.data || {};

  const uid = String(pick(data, ["uid", "event_uid", "id"], enrichedDoc._id ?? ""));
  const title = pick(data, ["title_fr", "title"], null);
  const description = pick(data, ["description_fr", "description"], null);
  const eventDate = pick(data, ["event_date", "date_start", "date"], null);
  const city = pick(data, ["location_city", "city"], "Unknown city");
  const country = pick(data, ["country_fr", "country"], "Unknown country");
  const address = pick(data, ["location_address", "address"], "");

  return {
    uid,
    title,
    description,
    eventDate,
    city,
    country,
    address,
  };
}
