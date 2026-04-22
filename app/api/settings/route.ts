import { getScoringConfig, DEFAULT_CONFIG, ScoringConfig } from "@/lib/scoring-config";
import { db } from "@/lib/db";
import postgres from "postgres";

export async function GET() {
  // Try to load from DB, fall back to defaults
  try {
    const sql = postgres(process.env.DATABASE_URL!, { max: 1, idle_timeout: 10 });
    const [row] = await sql`SELECT config FROM scoring_config WHERE id = 1`;
    await sql.end();
    if (row?.config) {
      return Response.json(row.config);
    }
  } catch {
    // Table might not exist yet
  }
  return Response.json(await getScoringConfig());
}

export async function POST(request: Request) {
  const config = await request.json() as ScoringConfig;

  try {
    const sql = postgres(process.env.DATABASE_URL!, { max: 1, idle_timeout: 10 });
    // Create table if needed
    await sql`CREATE TABLE IF NOT EXISTS scoring_config (id int PRIMARY KEY DEFAULT 1, config jsonb NOT NULL, updated_at timestamptz DEFAULT now(), CONSTRAINT single_row CHECK (id = 1))`;
    await sql`INSERT INTO scoring_config (id, config) VALUES (1, ${JSON.stringify(config)}::jsonb) ON CONFLICT (id) DO UPDATE SET config = ${JSON.stringify(config)}::jsonb, updated_at = now()`;
    await sql.end();
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Unknown" }, { status: 500 });
  }
}
