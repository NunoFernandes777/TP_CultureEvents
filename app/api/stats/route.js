import { db } from "@/lib/db";

export async function GET() {
  const [rows] = await db.execute(`
    SELECT l.city, COUNT(*) AS total_events
    FROM events e
    JOIN locations l ON e.location_id = l.id
    GROUP BY l.city
    ORDER BY total_events DESC
  `);

  return Response.json({
    totalCities: rows.length,
    stats: rows,
  });
}
