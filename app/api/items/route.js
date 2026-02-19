import { db } from "@/lib/db";

export async function GET(req) {
  const { searchParams } = new URL(req.url);

  const city = searchParams.get("city");
  const page = parseInt(searchParams.get("page")) || 1;
  const pageSize = parseInt(searchParams.get("pageSize")) || 10;
  const offset = (page - 1) * pageSize;

  let sql = `
    SELECT
      e.id,
      e.uid,
      e.title,
      e.description,
      e.event_date,
      l.city,
      l.country,
      COALESCE(MAX(et.code), 'other') AS category,
      COALESCE(MAX(et.label_fr), 'Autre') AS category_label,
      sch.starts_at,
      sch.ends_at,
      COALESCE(price.is_free, 0) AS is_free,
      price.min_amount,
      price.currency
    FROM events e
    JOIN locations l ON e.location_id = l.id
    LEFT JOIN events_event_types eet ON eet.event_id = e.id
    LEFT JOIN event_types et ON et.id = eet.event_type_id
    LEFT JOIN (
      SELECT event_id, MIN(starts_at) AS starts_at, MIN(ends_at) AS ends_at
      FROM event_schedules
      GROUP BY event_id
    ) sch ON sch.event_id = e.id
    LEFT JOIN (
      SELECT
        event_id,
        MAX(is_free) AS is_free,
        MIN(amount) AS min_amount,
        MAX(currency) AS currency
      FROM event_pricing
      GROUP BY event_id
    ) price ON price.event_id = e.id
    WHERE 1=1
  `;
  const params = [];

  if (city) {
    sql += " AND l.city = ?";
    params.push(city);
  }

  sql += `
    GROUP BY
      e.id, e.uid, e.title, e.description, e.event_date, l.city, l.country,
      sch.starts_at, sch.ends_at, price.is_free, price.min_amount, price.currency
    ORDER BY COALESCE(sch.starts_at, e.event_date) DESC
    LIMIT ? OFFSET ?
  `;
  params.push(pageSize, offset);

  const [rows] = await db.execute(sql, params);

  return Response.json({
    page,
    pageSize,
    items: rows,
  });
}
