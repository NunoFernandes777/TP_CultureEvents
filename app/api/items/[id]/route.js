import { db } from "@/lib/db";

export async function GET(_, { params }) {
  const [rows] = await db.execute(
    `
    SELECT e.*, l.city, l.country, l.address
    FROM events e
    JOIN locations l ON e.location_id = l.id
    WHERE e.id = ?
    `,
    [params.id]
  );

  if (rows.length === 0) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return Response.json(rows[0]);
}
