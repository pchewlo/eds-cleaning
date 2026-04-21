export const maxDuration = 60;

import { db } from "@/lib/db";
import { jobs, candidates, uploads } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { extractText } from "@/lib/cv-parser";
import { parseCsvCandidates } from "@/lib/csv-parser";
import { scoreCombined } from "@/lib/combined-scorer";
import { sendDigestEmail } from "@/lib/digest";
import { createHash } from "crypto";
import type { Job } from "@/lib/types";

function getQualAnswer(c: { qualifications: Array<{ question: string; answer: string }> }, keyword: string): string | undefined {
  return c.qualifications.find(q => q.question.toLowerCase().includes(keyword.toLowerCase()))?.answer;
}

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

  // Extract text from PDFs and keep raw data for storage
  const pdfCandidates: Array<{ filename: string; name: string; cvText: string; base64: string }> = [];
  for (const file of cvFiles) {
    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      const text = await extractText(buffer, file.name);
      const base64 = buffer.toString("base64");
      const nameFromFile = file.name
        .replace(/^Resume/i, "")
        .replace(/\.(pdf|docx?|txt)$/i, "")
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
        .trim();

      pdfCandidates.push({ filename: file.name, name: nameFromFile, cvText: text, base64 });
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
    // CSV only — no CVs to verify, mark as unverified
    scoredResults = csvCandidates.map((csv) => {
      const hasLicence = getQualAnswer(csv, "driving")?.toLowerCase() === "yes";
      const indeedYears = parseInt(getQualAnswer(csv, "cleaning experience") || "0") || 0;
      const postcode = getQualAnswer(csv, "postcode") || "";
      const selfReported = getQualAnswer(csv, "travel") || getQualAnswer(csv, "long") || null;
      return {
        candidateName: csv.name,
        candidateEmail: csv.email,
        candidatePhone: csv.phone,
        candidatePostcode: postcode || null,
        overallScore: -1,
        recommendation: "reject" as const,
        commute: {
          viable: false, estimatedMinutes: selfReported ? parseInt(selfReported) || null : null,
          drivingMinutes: null, transitMinutes: null, hasDriverLicence: hasLicence,
          reasoning: `${postcode || csv.location} → job. Self-reported: ${selfReported || "N/A"}. ${hasLicence ? "Has" : "No"} licence.`,
        },
        experience: {
          score: 0, yearsFromCv: 0, yearsFromIndeed: indeedYears,
          relevantRoles: csv.relevantExperience ? [csv.relevantExperience] : [],
          reasoning: `Claims ${indeedYears} years on Indeed — no CV to verify.`,
        },
        tenure: { avgYearsPerRole: 0, reasoning: "No CV available." },
        requirementsMet: [],
        redFlags: ["No CV uploaded — cannot verify experience"],
        summary: `No CV to verify. Indeed: ${indeedYears}yr claimed, ${hasLicence ? "drives" : "no licence"}.`,
        source: "csv_only" as const,
      };
    });
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
    const nameNorm = (s.candidateName || "").toLowerCase().trim().replace(/\s+/g, " ");
    const phoneNorm = (s.candidatePhone || "").replace(/[^0-9]/g, "");
    const fileHash = createHash("sha256")
      .update(`${nameNorm}:${phoneNorm}:${jobId}`)
      .digest("hex");

    // Dedup 1: hash match (name + phone)
    const [hashMatch] = await db
      .select({ id: candidates.id })
      .from(candidates)
      .where(and(eq(candidates.jobId, jobId), eq(candidates.fileHash, fileHash)))
      .limit(1);

    if (hashMatch) {
      duplicateCount++;
      continue;
    }

    // Dedup 2: name-only match (catches re-uploads with different phone formatting)
    if (nameNorm.length > 2) {
      const existingByName = await db
        .select({ id: candidates.id, name: candidates.name })
        .from(candidates)
        .where(eq(candidates.jobId, jobId));

      const nameMatch = existingByName.find((e) =>
        (e.name || "").toLowerCase().trim().replace(/\s+/g, " ") === nameNorm
      );

      if (nameMatch) {
        duplicateCount++;
        continue;
      }
    }

    // Find matching PDF for this candidate to store CV data
    const matchedPdf = pdfCandidates.find((p) => {
      const norm = (x: string) => x.toLowerCase().replace(/[^a-z]/g, "");
      return norm(p.name) === norm(s.candidateName || "");
    });

    await db.insert(candidates).values({
      jobId,
      name: s.candidateName,
      email: s.candidateEmail,
      phone: s.candidatePhone,
      cvBlobUrl: matchedPdf ? `pdf:${matchedPdf.filename}` : `scored:${s.source}`,
      cvData: matchedPdf?.base64 || null,
      cvFilename: matchedPdf?.filename || null,
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
