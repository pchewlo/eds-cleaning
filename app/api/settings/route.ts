import { getScoringConfig, ScoringConfig } from "@/lib/scoring-config";
import postgres from "postgres";

export async function GET() {
  try {
    const sql = postgres(process.env.DATABASE_URL!, { max: 1, idle_timeout: 10 });
    const [row] = await sql`SELECT config FROM scoring_config WHERE id = 1`;
    await sql.end();
    if (row?.config) {
      const config = typeof row.config === "string" ? JSON.parse(row.config) : row.config;
      return Response.json(config);
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
    await sql`CREATE TABLE IF NOT EXISTS scoring_config (id int PRIMARY KEY DEFAULT 1, config jsonb NOT NULL, updated_at timestamptz DEFAULT now(), CONSTRAINT single_row CHECK (id = 1))`;
    const configJson = JSON.stringify(config);
    await sql`INSERT INTO scoring_config (id, config) VALUES (1, ${configJson}::jsonb) ON CONFLICT (id) DO UPDATE SET config = ${configJson}::jsonb, updated_at = now()`;
    await sql.end();
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Unknown" }, { status: 500 });
  }
}
