import { db } from "@/lib/db";
import { candidates } from "@/lib/db/schema";
import { sql } from "drizzle-orm";

// DELETE CV data older than 30 days — call via cron
export async function POST() {
  const result = await db
    .update(candidates)
    .set({ cvData: null })
    .where(
      sql`${candidates.cvData} IS NOT NULL AND ${candidates.uploadedAt} < NOW() - INTERVAL '30 days'`
    )
    .returning({ id: candidates.id });

  return Response.json({ cleaned: result.length });
}
