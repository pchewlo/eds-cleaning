import { db } from "@/lib/db";
import { candidates } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [candidate] = await db
    .select({ cvData: candidates.cvData, cvFilename: candidates.cvFilename })
    .from(candidates)
    .where(eq(candidates.id, id))
    .limit(1);

  if (!candidate?.cvData) {
    return new Response("CV not available", { status: 404 });
  }

  const buffer = Buffer.from(candidate.cvData, "base64");
  const filename = candidate.cvFilename || "cv.pdf";

  return new Response(buffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
    },
  });
}
