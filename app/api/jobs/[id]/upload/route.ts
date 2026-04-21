export const maxDuration = 60;

import { db } from "@/lib/db";
import { jobs, candidates, uploads } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { extractText } from "@/lib/cv-parser";
import { parseCsvCandidates } from "@/lib/csv-parser";
import { scoreCombined } from "@/lib/combined-scorer";
import { scoreCsvCandidates } from "@/lib/csv-scorer";
import { sendDigestEmail } from "@/lib/digest";
import { createHash } from "crypto";
import type { Job } from "@/lib/types";

function toV1Job(dbJob: { id: string; title: string; location: string | null; description: string }): Job {
  return {
    id: dbJob.id, url: "", title: dbJob.title, postcode: dbJob.location || "",
    location: dbJob.location || "", hourlyRate: "", hoursPerWeek: 0,
    shiftPattern: "", shiftType: "unknown", requirements: [], fullDescription: dbJob.description,
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

  // Get CSV file (single)
  const csvFile = formData.get("csv") as File | null;

  // Get CV files (multiple)
  const cvFiles: File[] = [];
  for (const [key, value] of formData.entries()) {
    if (key === "cvs" && value instanceof File) {
      cvFiles.push(value);
    }
    // Backwards compat: also accept "files" key
    if (key === "files" && value instanceof File) {
      if (value.name.toLowerCase().endsWith(".csv")) {
        // treat as CSV
      } else {
        cvFiles.push(value);
      }
    }
  }

  if (!csvFile && cvFiles.length === 0) {
    return Response.json({ error: "No files uploaded" }, { status: 400 });
  }

  let newCount = 0;
  let duplicateCount = 0;

  // Parse CSV if provided
  const csvCandidates = csvFile
    ? parseCsvCandidates(Buffer.from(await csvFile.arrayBuffer()).toString("utf-8"))
    : [];

  // Extract text from PDFs
  const pdfCandidates: Array<{ filename: string; name: string; cvText: string }> = [];
  for (const file of cvFiles) {
    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      const text = await extractText(buffer, file.name);
      // Extract name from filename: "ResumeJohnSmith.pdf" → "John Smith"
      const nameFromFile = file.name
        .replace(/^Resume/i, "")
        .replace(/\.(pdf|docx?|txt)$/i, "")
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
        .trim();

      pdfCandidates.push({ filename: file.name, name: nameFromFile, cvText: text });
    } catch (e) {
      console.error(`Failed to extract text from ${file.name}:`, e);
    }
  }

  // Score based on what we have
  let scoredResults;

  if (csvCandidates.length > 0 && pdfCandidates.length > 0) {
    // Combined scoring — best accuracy
    scoredResults = await scoreCombined({
      csvCandidates,
      pdfCandidates,
      jobTitle: job.title,
      jobDescription: job.description,
      jobPostcode: job.location || "",
      requirements: [],
    });
  } else if (csvCandidates.length > 0) {
    // CSV only — algorithmic scoring
    const v1Job = toV1Job(job);
    const csvScored = await scoreCsvCandidates(csvCandidates, v1Job);
    scoredResults = csvScored.map((s) => ({
      candidateName: s.candidateName,
      candidateEmail: s.candidateEmail,
      candidatePhone: s.candidatePhone,
      candidatePostcode: s.candidatePostcode,
      overallScore: s.overallScore,
      recommendation: s.recommendation,
      commute: s.commute,
      experience: {
        score: s.experience.score,
        yearsFromCv: 0,
        yearsFromIndeed: s.experience.yearsOfRelevantWork,
        relevantRoles: s.experience.relevantRoles,
        reasoning: s.experience.reasoning,
      },
      tenure: { avgYearsPerRole: 0, reasoning: "No CV available" },
      requirementsMet: s.requirementsMet,
      redFlags: s.redFlags,
      summary: s.summary + " (CSV only)",
      source: "csv_only" as const,
    }));
  } else {
    // PDFs only — Claude scoring without metadata
    scoredResults = await scoreCombined({
      csvCandidates: [],
      pdfCandidates,
      jobTitle: job.title,
      jobDescription: job.description,
      jobPostcode: job.location || "",
      requirements: [],
    });
  }

  // Insert into DB
  for (const s of scoredResults) {
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
      cvBlobUrl: `scored:${s.source}`,
      cvText: null,
      fileHash,
      metadataJson: {
        commute: s.commute,
        experience: s.experience,
        tenure: s.tenure,
        requirementsMet: s.requirementsMet,
        redFlags: s.redFlags,
        postcode: s.candidatePostcode,
        source: s.source,
      },
      rankScore: String(s.overallScore / 10),
      rankReasoning: s.summary,
      rankFlags: s.redFlags,
      rankedAt: new Date(),
    });

    newCount++;
  }

  // Create upload record
  const [upload] = await db
    .insert(uploads)
    .values({ jobId, newCount, duplicateCount })
    .returning();

  // Send digest email
  if (newCount > 0) {
    try {
      const allCandidates = await db.select().from(candidates).where(eq(candidates.jobId, jobId));
      const ranked = allCandidates
        .filter((c) => c.rankScore !== null)
        .map((c) => ({
          id: c.id, name: c.name, phone: c.phone, email: c.email,
          score: parseFloat(c.rankScore || "0"),
          reasoning: c.rankReasoning || "",
          flags: (c.rankFlags as string[]) || [],
        }));

      const appUrl = process.env.AUTH_URL || `https://${process.env.VERCEL_URL || "localhost:3000"}`;
      await sendDigestEmail({
        to: job.recipientEmail, jobTitle: job.title, jobLocation: job.location,
        jobId: job.id, newCount, duplicateCount, candidates: ranked, appUrl,
      });
      await db.update(uploads).set({ digestSentAt: new Date() }).where(eq(uploads.id, upload.id));
    } catch (e) {
      console.error("Digest email failed:", e);
      await db.update(uploads).set({ digestError: e instanceof Error ? e.message : "Unknown" }).where(eq(uploads.id, upload.id));
    }
  }

  const allCandidates = await db.select().from(candidates).where(eq(candidates.jobId, jobId));

  return Response.json({
    newCount,
    duplicateCount,
    candidates: allCandidates.sort(
      (a, b) => parseFloat(b.rankScore || "0") - parseFloat(a.rankScore || "0")
    ),
  });
}
