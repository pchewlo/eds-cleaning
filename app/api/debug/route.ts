import postgres from "postgres";

export async function GET() {
  const url = process.env.DATABASE_URL;
  if (!url) return Response.json({ error: "No DATABASE_URL" });

  try {
    const sql = postgres(url);
    const result = await sql`SELECT id, title, archived_at FROM jobs`;
    const tables = await sql`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`;
    await sql.end();

    return Response.json({
      dbConnected: true,
      totalJobs: result.length,
      jobs: result,
      tables: tables.map((t) => (t as Record<string, string>).tablename),
      dbUrlPrefix: url.substring(0, 50),
    });
  } catch (e) {
    return Response.json({
      dbConnected: false,
      error: e instanceof Error ? e.message : "Unknown",
      dbUrlPrefix: url?.substring(0, 50),
    });
  }
}
