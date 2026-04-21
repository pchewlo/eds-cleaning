export const maxDuration = 60;

import { db } from "@/lib/db";
import { jobs, candidates, uploads } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { extractText } from "@/lib/cv-parser";
import { parseCsvCandidates } from "@/lib/csv-parser";
import { scoreCsvCandidates } from "@/lib/csv-scorer";
import { scoreCandidate } from "@/lib/claude";
import { sendDigestEmail } from "@/lib/digest";
import { createHash } from "crypto";
import type { Job } from "@/lib/types";

function isCsvFile(name: string): boolean {
  return name.toLowerCase().endsWith(".csv");
}

// Build a v1-compatible Job object from the DB job
function toV1Job(dbJob: { id: string; title: string; location: string | null; description: string }): Job {
  const postcode = dbJob.location || "";
  return {
    id: dbJob.id,
    url: "",
    title: dbJob.title,
    postcode,
    location: dbJob.location || "",
    hourlyRate: "",
    hoursPerWeek: 0,
    shiftPattern: "",
    shiftType: "unknown",
    requirements: [],
    fullDescription: dbJob.description,
  };
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: jobId } = await params;

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

  const csvFiles = files.filter((f) => isCsvFile(f.name));
  const cvFiles = files.filter((f) => !isCsvFile(f.name));

  // Process CSV files using the v1 detailed scorer
  for (const csvFile of csvFiles) {
    try {
      const buffer = Buffer.from(await csvFile.arrayBuffer());
      const text = buffer.toString("utf-8");
      const csvCandidates = parseCsvCandidates(text);

      if (csvCandidates.length === 0) continue;

      const v1Job = toV1Job(job);
      const scored = await scoreCsvCandidates(csvCandidates, v1Job);

      for (const s of scored) {
        // Dedup by name+phone within this job
        const nameNorm = (s.candidateName || "").toLowerCase().trim();
        const phoneNorm = (s.candidatePhone || "").replace(/[^0-9+]/g, "");
        const fileHash = createHash("sha256")
          .update(`${nameNorm}:${phoneNorm}:${jobId}`)
          .digest("hex");

        const [existing] = await db
          .select({ id: candidates.id })
          .from(candidates)
          .where(and(eq(candidates.jobId, jobId), eq(candidates.fileHash, fileHash)))
          .limit(1);

        if (existing) {
          duplicateCount++;
          continue;
        }

        await db.insert(candidates).values({
          jobId,
          name: s.candidateName,
          email: s.candidateEmail,
          phone: s.candidatePhone,
          cvBlobUrl: `csv:${csvFile.name}`,
          cvText: null,
          fileHash,
          metadataJson: {
            commute: s.commute,
            experience: s.experience,
            requirementsMet: s.requirementsMet,
            redFlags: s.redFlags,
            postcode: s.candidatePostcode,
          },
          rankScore: String(s.overallScore / 10), // Convert 0-100 to 0-10
          rankReasoning: s.summary,
          rankFlags: s.redFlags,
          rankedAt: new Date(),
        });

        newCount++;
      }
    } catch (e) {
      console.error(`CSV processing failed for ${csvFile.name}:`, e);
    }
  }

  // Process individual CV files (PDF/DOCX/TXT) with Claude
  for (const file of cvFiles) {
    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      const fileHash = createHash("sha256").update(buffer).digest("hex");

      const [existing] = await db
        .select({ id: candidates.id })
        .from(candidates)
        .where(and(eq(candidates.jobId, jobId), eq(candidates.fileHash, fileHash)))
        .limit(1);

      if (existing) {
        duplicateCount++;
        continue;
      }

      let cvText = "";
      try {
        cvText = await extractText(buffer, file.name);
      } catch {
        cvText = "";
      }

      const v1Job = toV1Job(job);
      const scored = await scoreCandidate(v1Job, cvText);

      await db.insert(candidates).values({
        jobId,
        name: scored.candidateName,
        email: scored.candidateEmail,
        phone: scored.candidatePhone,
        cvBlobUrl: `file:${file.name}`,
        cvText,
        fileHash,
        metadataJson: {
          commute: scored.commute,
          experience: scored.experience,
          requirementsMet: scored.requirementsMet,
          redFlags: scored.redFlags,
          postcode: scored.candidatePostcode,
        },
        rankScore: String(scored.overallScore / 10),
        rankReasoning: scored.summary,
        rankFlags: scored.redFlags,
        rankedAt: new Date(),
      });

      newCount++;
    } catch (e) {
      console.error(`CV processing failed for ${file.name}:`, e);
    }
  }

  // Create upload record
  const [upload] = await db
    .insert(uploads)
    .values({ jobId, newCount, duplicateCount })
    .returning();

  // Send digest email
  if (newCount > 0) {
    try {
      const allCandidates = await db
        .select()
        .from(candidates)
        .where(eq(candidates.jobId, jobId));

      const ranked = allCandidates
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

      const appUrl = process.env.AUTH_URL || `https://${process.env.VERCEL_URL || "localhost:3000"}`;

      await sendDigestEmail({
        to: job.recipientEmail,
        jobTitle: job.title,
        jobLocation: job.location,
        jobId: job.id,
        newCount,
        duplicateCount,
        candidates: ranked,
        appUrl,
      });

      await db.update(uploads).set({ digestSentAt: new Date() }).where(eq(uploads.id, upload.id));
    } catch (e) {
      console.error("Digest email failed:", e);
      await db
        .update(uploads)
        .set({ digestError: e instanceof Error ? e.message : "Unknown" })
        .where(eq(uploads.id, upload.id));
    }
  }

  // Return all candidates
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
