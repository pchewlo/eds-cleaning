import { db } from "@/lib/db";
import { candidates } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// DELETE all candidates for a job (for testing)
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: jobId } = await params;
  await db.delete(candidates).where(eq(candidates.jobId, jobId));
  return Response.json({ ok: true });
}
