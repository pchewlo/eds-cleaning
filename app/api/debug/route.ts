import postgres from "postgres";

export async function POST() {
  const url = process.env.DATABASE_URL;
  if (!url) return Response.json({ error: "No DATABASE_URL" });

  const sql = postgres(url);
  await sql`INSERT INTO jobs (id, title, location, description, recipient_email) VALUES
    ('14978', 'Cleaner, Chesterfield, S41 7LF (15 hours per week)', 'S41 7LF', 'Cleaner position Mon-Fri 16:00-19:00', 'tclittler@gmail.com'),
    ('14977', 'Mobile Relief Cleaning Operative', 'S9 3RS', 'Mobile cleaning operative role', 'tclittler@gmail.com'),
    ('14963', 'Cleaner required, Sheffield, 6 hours per week', 'S4 7QQ', 'Part time cleaning role', 'tclittler@gmail.com'),
    ('14958', 'Cleaner, early mornings, 11.25 hours per week', 'S43 3HB', 'Early morning cleaning role', 'tclittler@gmail.com'),
    ('14742', 'Cleaner, Rotherham, 12.5 hours per week, mornings', 'S60 5ES', 'Morning cleaning role Rotherham', 'tclittler@gmail.com')
  ON CONFLICT (id) DO UPDATE SET archived_at = NULL, title = EXCLUDED.title`;
  const count = await sql`SELECT count(*) FROM jobs`;
  await sql.end();
  return Response.json({ seeded: true, count: count[0].count });
}

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
