import { db } from "@/lib/db";
import { candidates, uploads } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// DELETE all candidates + uploads for a job (for testing)
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: jobId } = await params;
  await db.delete(candidates).where(eq(candidates.jobId, jobId));
  await db.delete(uploads).where(eq(uploads.jobId, jobId));
  return Response.json({ ok: true });
}
