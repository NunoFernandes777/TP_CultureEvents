import test from "node:test";
import assert from "node:assert/strict";
import mysql from "mysql2/promise";

import {
  parseRawPayload,
  enrichParsedRecord,
  mapEnrichedToSqlRow,
} from "../../lib/etl.js";

const RUN_API_INTEGRATION = process.env.RUN_API_INTEGRATION === "1";
const RUN_SQL_INTEGRATION = process.env.RUN_SQL_INTEGRATION === "1";

const MYSQL_CONFIG = {
  host: process.env.MYSQL_HOST ?? "127.0.0.1",
  user: process.env.MYSQL_USER ?? "root",
  password: process.env.MYSQL_PASSWORD ?? "",
  database: process.env.MYSQL_DATABASE ?? "cultural_events",
  port: Number(process.env.MYSQL_PORT || 3306),
};

test(
  "integration: real API endpoint responds with records",
  { skip: !RUN_API_INTEGRATION },
  async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch(
        "https://public.opendatasoft.com/api/records/1.0/search/?dataset=evenements-publics-openagenda&rows=5",
        { signal: controller.signal }
      );
      assert.equal(response.ok, true);

      const json = await response.json();
      assert.equal(Array.isArray(json.records), true);
      assert.ok(json.records.length > 0);
    } finally {
      clearTimeout(timeout);
    }
  }
);

test(
  "integration: SQL query executes against MySQL",
  { skip: !RUN_SQL_INTEGRATION },
  async () => {
    const sql = await mysql.createConnection(MYSQL_CONFIG);
    try {
      const [rows] = await sql.query("SELECT 1 AS ok");
      assert.equal(rows[0].ok, 1);
    } finally {
      await sql.end();
    }
  }
);

test(
  "integration: full mini ETL pipeline on a small dataset",
  { skip: !RUN_SQL_INTEGRATION },
  async () => {
    const sql = await mysql.createConnection(MYSQL_CONFIG);

    try {
      await sql.execute(`
        CREATE TEMPORARY TABLE it_locations (
          id INT AUTO_INCREMENT PRIMARY KEY,
          city VARCHAR(255) NOT NULL,
          country VARCHAR(255) NOT NULL,
          address VARCHAR(255) NOT NULL,
          UNIQUE KEY uniq_location (city, country, address)
        )
      `);

      await sql.execute(`
        CREATE TEMPORARY TABLE it_events (
          id INT AUTO_INCREMENT PRIMARY KEY,
          uid VARCHAR(255) NOT NULL UNIQUE,
          title VARCHAR(255) NOT NULL,
          description TEXT NULL,
          event_date VARCHAR(64) NULL,
          location_id INT NOT NULL
        )
      `);

      const payload = {
        records: [
          {
            fields: {
              uid: "mini-1",
              title_fr: "Concert acoustique",
              description_fr: "Live session",
              location_address: "1 rue test",
              country_fr: "France",
              location_city: "Paris",
              event_date: "2026-03-10",
            },
          },
          {
            fields: {
              uid: "mini-2",
              title_fr: null,
              location_city: "Lyon",
            },
          },
        ],
      };

      const parsed = parseRawPayload(payload);
      const enriched = parsed.map((record, index) =>
        enrichParsedRecord(record, `raw-mini-${index}`)
      );
      const successful = enriched.filter((doc) => doc.status === "success");

      for (const doc of successful) {
        const row = mapEnrichedToSqlRow(doc);

        const [locResult] = await sql.execute(
          `
          INSERT INTO it_locations (city, country, address)
          VALUES (?, ?, ?)
          ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)
          `,
          [row.city, row.country, row.address]
        );

        const locationId = locResult.insertId;

        await sql.execute(
          `
          INSERT INTO it_events (uid, title, description, event_date, location_id)
          VALUES (?, ?, ?, ?, ?)
          `,
          [row.uid, row.title, row.description, row.eventDate, locationId]
        );
      }

      const [eventRows] = await sql.query("SELECT COUNT(*) AS total FROM it_events");
      const [locationRows] = await sql.query(
        "SELECT COUNT(*) AS total FROM it_locations"
      );

      assert.equal(successful.length, 1);
      assert.equal(eventRows[0].total, 1);
      assert.equal(locationRows[0].total, 1);
    } finally {
      await sql.end();
    }
  }
);
