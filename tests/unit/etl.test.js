import test from "node:test";
import assert from "node:assert/strict";

import {
  normalizeText,
  parseRawPayload,
  enrichParsedRecord,
  mapEnrichedToSqlRow,
} from "../../lib/etl.js";

test("normalization removes accents and lowercases text", () => {
  const normalized = normalizeText("Théâtre Musée ÉTÉ");
  assert.equal(normalized, "theatre musee ete");
});

test("parsing extracts expected fields from raw payload", () => {
  const payload = {
    records: [
      {
        fields: {
          uid: "evt-1",
          title_fr: "Concert Jazz",
          description_fr: "Live at night",
          location_address: "10 Main St",
          country_fr: "France",
          location_city: "Paris",
          event_date: "2026-01-01",
        },
      },
    ],
  };

  const parsed = parseRawPayload(payload);

  assert.equal(parsed.length, 1);
  assert.deepEqual(parsed[0], {
    uid: "evt-1",
    title_fr: "Concert Jazz",
    description_fr: "Live at night",
    location_address: "10 Main St",
    country_fr: "France",
    location_city: "Paris",
    event_date: "2026-01-01",
  });
});

test("enrichment marks record as failed when mandatory fields are missing", () => {
  const enriched = enrichParsedRecord(
    {
      uid: "evt-2",
      title_fr: null,
      location_city: "Paris",
    },
    "raw-1"
  );

  assert.equal(enriched.status, "failed");
  assert.equal(enriched.error.code, "MISSING_FIELDS");
});

test("enrichment computes a category for a valid record", () => {
  const enriched = enrichParsedRecord(
    {
      uid: "evt-3",
      title_fr: "Atelier cuisine",
      description_fr: "Initiation workshop",
      location_city: "Lyon",
    },
    "raw-2"
  );

  assert.equal(enriched.status, "success");
  assert.equal(enriched.data.category, "workshop");
});

test("etl mapping builds SQL-ready values with defaults", () => {
  const sqlRow = mapEnrichedToSqlRow({
    _id: "mongo-id-1",
    data: {
      uid: "evt-4",
      title_fr: "Exposition Moderne",
      description_fr: null,
      location_city: "Bordeaux",
      country_fr: null,
      location_address: null,
      event_date: "2026-02-01",
    },
  });

  assert.equal(sqlRow.uid, "evt-4");
  assert.equal(sqlRow.title, "Exposition Moderne");
  assert.equal(sqlRow.city, "Bordeaux");
  assert.equal(sqlRow.country, "Unknown country");
  assert.equal(sqlRow.address, "");
  assert.equal(sqlRow.eventDate, "2026-02-01");
});
