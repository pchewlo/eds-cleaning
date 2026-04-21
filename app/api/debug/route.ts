import postgres from "postgres";

export async function GET(request: Request) {
  const url = process.env.DATABASE_URL;
  if (!url) return Response.json({ error: "No DATABASE_URL" });

  const { searchParams } = new URL(request.url);
  const migrate = searchParams.get("migrate") === "true";
  const reset = searchParams.get("reset") === "true";

  try {
    const sql = postgres(url);

    if (migrate) {
      await sql`ALTER TABLE candidates ADD COLUMN IF NOT EXISTS cv_data text`;
      await sql`ALTER TABLE candidates ADD COLUMN IF NOT EXISTS cv_filename text`;
    }

    if (reset) {
      await sql`DROP TABLE IF EXISTS uploads CASCADE`;
      await sql`DROP TABLE IF EXISTS candidates CASCADE`;
      await sql`DROP TABLE IF EXISTS jobs CASCADE`;
      await sql`DROP TABLE IF EXISTS users CASCADE`;

      await sql`CREATE TABLE users (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text UNIQUE NOT NULL, name text, created_at timestamptz DEFAULT now())`;
      await sql`CREATE TABLE jobs (id text PRIMARY KEY, title text NOT NULL, location text, description text NOT NULL, criteria_json jsonb, recipient_email text NOT NULL, created_by uuid REFERENCES users(id), created_at timestamptz DEFAULT now(), archived_at timestamptz)`;
      await sql`CREATE TABLE candidates (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), job_id text NOT NULL REFERENCES jobs(id) ON DELETE CASCADE, name text, email text, phone text, cv_blob_url text NOT NULL, cv_data text, cv_filename text, cv_text text, file_hash text NOT NULL, metadata_json jsonb, rank_score numeric, rank_reasoning text, rank_flags jsonb, uploaded_by uuid REFERENCES users(id), uploaded_at timestamptz DEFAULT now(), ranked_at timestamptz)`;
      await sql`CREATE UNIQUE INDEX IF NOT EXISTS candidates_job_id_file_hash_idx ON candidates(job_id, file_hash)`;
      await sql`CREATE INDEX IF NOT EXISTS candidates_job_id_rank_score_idx ON candidates(job_id, rank_score DESC)`;
      await sql`CREATE TABLE uploads (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), job_id text REFERENCES jobs(id), uploaded_by uuid REFERENCES users(id), uploaded_at timestamptz DEFAULT now(), new_count integer, duplicate_count integer, digest_sent_at timestamptz, digest_error text)`;

      await sql`INSERT INTO jobs (id, title, location, description, recipient_email) VALUES
        ('14978', 'Cleaner, Chesterfield, S41 7LF (15 hours per week)', 'S41 7LF', 'Cleaner position Mon-Fri 16:00-19:00, 15hrs/week, £12.71/hr', 'tclittler@gmail.com'),
        ('14977', 'Mobile Relief Cleaning Operative', 'S9 3RS', 'Mobile cleaning operative role in Sheffield', 'tclittler@gmail.com'),
        ('14963', 'Cleaner required, Sheffield, 6 hours per week', 'S4 7QQ', 'Part time cleaning role in Sheffield', 'tclittler@gmail.com'),
        ('14958', 'Cleaner, early mornings, 11.25 hours per week', 'S43 3HB', 'Early morning cleaning role in Chesterfield', 'tclittler@gmail.com'),
        ('14742', 'Cleaner, Rotherham, 12.5 hours per week, mornings', 'S60 5ES', 'Morning cleaning role in Rotherham', 'tclittler@gmail.com')`;
    }

    const cols = await sql`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'candidates' AND column_name IN ('cv_data', 'cv_filename')`;
    const rows = await sql`SELECT id, title FROM jobs LIMIT 5`;
    await sql.end();

    return Response.json({
      jobs: rows,
      cvColumns: cols,
      migrateApplied: migrate,
      resetApplied: reset,
    });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Unknown" });
  }
}
