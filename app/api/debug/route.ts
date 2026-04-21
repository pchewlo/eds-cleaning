import postgres from "postgres";

export async function GET() {
  const url = process.env.DATABASE_URL;
  if (!url) return Response.json({ error: "No DATABASE_URL" });

  try {
    const sql = postgres(url);

    // Seed if empty
    const existing = await sql`SELECT count(*) as c FROM jobs`;
    if (parseInt(existing[0].c) === 0) {
      await sql`INSERT INTO jobs (id, title, location, description, recipient_email) VALUES
        ('14978', 'Cleaner, Chesterfield, S41 7LF (15 hours per week)', 'S41 7LF', 'Cleaner position Mon-Fri 16:00-19:00', 'tclittler@gmail.com'),
        ('14977', 'Mobile Relief Cleaning Operative', 'S9 3RS', 'Mobile cleaning operative role', 'tclittler@gmail.com'),
        ('14963', 'Cleaner required, Sheffield, 6 hours per week', 'S4 7QQ', 'Part time cleaning role', 'tclittler@gmail.com'),
        ('14958', 'Cleaner, early mornings, 11.25 hours per week', 'S43 3HB', 'Early morning cleaning role', 'tclittler@gmail.com'),
        ('14742', 'Cleaner, Rotherham, 12.5 hours per week, mornings', 'S60 5ES', 'Morning cleaning role Rotherham', 'tclittler@gmail.com')
      ON CONFLICT (id) DO UPDATE SET archived_at = NULL`;
    }

    const result = await sql`SELECT id, title, archived_at FROM jobs`;
    await sql.end();

    return Response.json({
      totalJobs: result.length,
      jobs: result,
      seeded: parseInt(existing[0].c) === 0,
    });
  } catch (e) {
    return Response.json({
      error: e instanceof Error ? e.message : "Unknown",
    });
  }
}
