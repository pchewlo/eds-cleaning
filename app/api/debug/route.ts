import postgres from "postgres";

export async function GET() {
  const url = process.env.DATABASE_URL;
  if (!url) return Response.json({ error: "No DATABASE_URL" });

  try {
    const sql = postgres(url);
    const cols = await sql`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'jobs'`;
    const rows = await sql`SELECT count(*) as c FROM jobs`;
    await sql.end();

    return Response.json({
      columns: cols,
      rowCount: rows[0].c,
      dbUrl: url.substring(0, 60),
    });
  } catch (e) {
    return Response.json({
      error: e instanceof Error ? e.message : "Unknown",
      dbUrl: url?.substring(0, 60),
    });
  }
}
