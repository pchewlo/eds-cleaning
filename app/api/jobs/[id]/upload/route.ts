export const maxDuration = 60;

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { jobs, candidates, uploads } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { extractText } from "@/lib/cv-parser";
import { rankCandidates } from "@/lib/ranker";
import { sendDigestEmail } from "@/lib/digest";
import { createHash } from "crypto";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id: jobId } = await params;

  // Fetch job
  const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1);
  if (!job) return Response.json({ error: "Job not found" }, { status: 404 });

  const formData = await request.formData();
  const files: File[] = [];
  for (const [key, value] of formData.entries()) {
    if (key === "files" && value instanceof File) {
      files.push(value);
    }
  }

  if (files.length === 0) {
    return Response.json({ error: "No files uploaded" }, { status: 400 });
  }

  let newCount = 0;
  let duplicateCount = 0;
  const newCandidateIds: string[] = [];

  for (const file of files) {
    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      const fileHash = createHash("sha256").update(buffer).digest("hex");

      // Dedup stage 1: hash match
      const [existing] = await db
        .select({ id: candidates.id })
        .from(candidates)
        .where(and(eq(candidates.jobId, jobId), eq(candidates.fileHash, fileHash)))
        .limit(1);

      if (existing) {
        duplicateCount++;
        continue;
      }

      // Extract text
      let cvText: string;
      try {
        cvText = await extractText(buffer, file.name);
      } catch {
        cvText = "";
      }

      // Parse name/email/phone from text (best effort)
      const parsedName = extractName(cvText);
      const parsedEmail = extractEmail(cvText);
      const parsedPhone = extractPhone(cvText);

      // Dedup stage 2: identity match
      if (parsedName && (parsedEmail || parsedPhone)) {
        const identityDupes = await db
          .select({ id: candidates.id })
          .from(candidates)
          .where(eq(candidates.jobId, jobId))
          .limit(100);

        // Check against existing candidates
        let isDupe = false;
        for (const existing of identityDupes) {
          const [existingCandidate] = await db
            .select({ name: candidates.name, email: candidates.email, phone: candidates.phone })
            .from(candidates)
            .where(eq(candidates.id, existing.id))
            .limit(1);

          if (existingCandidate) {
            const nameMatch =
              parsedName &&
              existingCandidate.name &&
              normalise(parsedName) === normalise(existingCandidate.name);
            const emailMatch =
              parsedEmail &&
              existingCandidate.email &&
              normalise(parsedEmail) === normalise(existingCandidate.email);
            const phoneMatch =
              parsedPhone &&
              existingCandidate.phone &&
              normalisePhone(parsedPhone) === normalisePhone(existingCandidate.phone);

            if (nameMatch && (emailMatch || phoneMatch)) {
              isDupe = true;
              break;
            }
          }
        }

        if (isDupe) {
          duplicateCount++;
          continue;
        }
      }

      // Store CV as base64 data URL (Vercel Blob alternative — simple for v1)
      const cvBlobUrl = `data:application/octet-stream;name=${encodeURIComponent(file.name)}`;

      // Insert candidate
      const [inserted] = await db
        .insert(candidates)
        .values({
          jobId,
          name: parsedName,
          email: parsedEmail,
          phone: parsedPhone,
          cvBlobUrl,
          cvText,
          fileHash,
        })
        .returning({ id: candidates.id });

      newCandidateIds.push(inserted.id);
      newCount++;
    } catch (e) {
      console.error(`Failed to process ${file.name}:`, e);
    }
  }

  // Rank new candidates
  if (newCandidateIds.length > 0) {
    const newCandidates = await db
      .select()
      .from(candidates)
      .where(
        and(
          eq(candidates.jobId, jobId),
          // Only unranked
        )
      );

    const toRank = newCandidates.filter((c) => newCandidateIds.includes(c.id));

    const rankings = await rankCandidates({
      job: { title: job.title, description: job.description },
      candidates: toRank.map((c) => ({
        id: c.id,
        cvText: c.cvText || "",
      })),
    });

    // Write scores back
    for (const rank of rankings) {
      await db
        .update(candidates)
        .set({
          rankScore: String(rank.score),
          rankReasoning: rank.reasoning,
          rankFlags: rank.flags,
          rankedAt: new Date(),
        })
        .where(eq(candidates.id, rank.id));
    }
  }

  // Create upload record
  const [upload] = await db
    .insert(uploads)
    .values({
      jobId,
      newCount,
      duplicateCount,
    })
    .returning();

  // Send digest email
  if (newCount > 0) {
    try {
      const allCandidates = await db
        .select()
        .from(candidates)
        .where(eq(candidates.jobId, jobId));

      const rankedCandidates = allCandidates
        .filter((c) => c.rankScore !== null)
        .map((c) => ({
          id: c.id,
          name: c.name,
          phone: c.phone,
          email: c.email,
          score: parseFloat(c.rankScore || "0"),
          reasoning: c.rankReasoning || "",
          flags: (c.rankFlags as string[]) || [],
        }));

      const appUrl = process.env.AUTH_URL || process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "http://localhost:3000";

      await sendDigestEmail({
        to: job.recipientEmail,
        jobTitle: job.title,
        jobLocation: job.location,
        jobId: job.id,
        newCount,
        duplicateCount,
        candidates: rankedCandidates,
        appUrl,
      });

      await db
        .update(uploads)
        .set({ digestSentAt: new Date() })
        .where(eq(uploads.id, upload.id));
    } catch (e) {
      console.error("Digest email failed:", e);
      await db
        .update(uploads)
        .set({ digestError: e instanceof Error ? e.message : "Unknown error" })
        .where(eq(uploads.id, upload.id));
    }
  }

  // Return all candidates for this job
  const allCandidates = await db
    .select()
    .from(candidates)
    .where(eq(candidates.jobId, jobId));

  return Response.json({
    newCount,
    duplicateCount,
    candidates: allCandidates.sort(
      (a, b) => parseFloat(b.rankScore || "0") - parseFloat(a.rankScore || "0")
    ),
  });
}

// Helpers
function normalise(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, " ");
}

function normalisePhone(s: string): string {
  return s.replace(/[^0-9+]/g, "");
}

function extractName(text: string): string | null {
  // First non-empty line is often the name
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return null;
  const first = lines[0];
  // Heuristic: if the first line is short and doesn't look like an email/phone/url
  if (first.length < 60 && !first.includes("@") && !first.includes("http")) {
    return first;
  }
  return null;
}

function extractEmail(text: string): string | null {
  const match = text.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
  return match ? match[0] : null;
}

function extractPhone(text: string): string | null {
  const match = text.match(/(?:\+44|0)\s*\d[\d\s]{8,12}/);
  return match ? match[0].trim() : null;
}
