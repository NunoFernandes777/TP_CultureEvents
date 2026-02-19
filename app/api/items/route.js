import { db } from "@/lib/db";

export async function GET(req) {
  const { searchParams } = new URL(req.url);

  const city = searchParams.get("city");
  const page = parseInt(searchParams.get("page")) || 1;
  const pageSize = parseInt(searchParams.get("pageSize")) || 10;
  const offset = (page - 1) * pageSize;

  let sql = `
    SELECT e.id, e.title, e.event_date, l.city, l.country
    FROM events e
    JOIN locations l ON e.location_id = l.id
    WHERE 1=1
  `;
  const params = [];

  if (city) {
    sql += " AND l.city = ?";
    params.push(city);
  }

  sql += " ORDER BY e.event_date DESC LIMIT ? OFFSET ?";
  params.push(pageSize, offset);

  const [rows] = await db.execute(sql, params);

  return Response.json({
    page,
    pageSize,
    items: rows,
  });
}
