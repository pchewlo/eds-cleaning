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

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: jobId } = await params;

  const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1);
  if (!job) return Response.json({ error: "Job not found" }, { status: 404 });

  const formData = await request.formData();
  const csvFile = formData.get("csv") as File | null;
  const cvFiles: File[] = [];
  for (const [key, value] of formData.entries()) {
    if ((key === "cvs" || key === "files") && value instanceof File && !value.name.toLowerCase().endsWith(".csv")) {
      cvFiles.push(value);
    }
  }

  if (!csvFile && cvFiles.length === 0) {
    return Response.json({ error: "No files uploaded" }, { status: 400 });
  }

  let newCount = 0;
  let duplicateCount = 0;

  // Parse CSV
  const csvCandidates = csvFile
    ? parseCsvCandidates(Buffer.from(await csvFile.arrayBuffer()).toString("utf-8"))
    : [];

  // Extract PDF text + store raw data
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
      console.error(`Failed to extract ${file.name}:`, e);
    }
  }

  // Score
  let scoredResults;
  if (csvCandidates.length > 0 && pdfCandidates.length > 0) {
    scoredResults = await scoreCombined({
      csvCandidates, pdfCandidates,
      jobTitle: job.title, jobDescription: job.description,
      jobPostcode: job.location || "", requirements: [],
    });
  } else if (csvCandidates.length > 0) {
    // CSV only — get Google Maps distances, mark as unverified score
    const { getDistancesBatch } = await import("@/lib/distance");
    const postcodes = csvCandidates.map((c) => getQualAnswer(c, "postcode") || c.location || "");
    let distances: Awaited<ReturnType<typeof getDistancesBatch>> | null = null;
    try {
      distances = await getDistancesBatch(postcodes, job.location || "");
    } catch (e) {
      console.error("Distance lookup failed:", e);
    }

    scoredResults = csvCandidates.map((csv, i) => {
      const hasLicence = getQualAnswer(csv, "driving")?.toLowerCase() === "yes";
      const indeedYears = parseInt(getQualAnswer(csv, "cleaning experience") || "0") || 0;
      const postcode = getQualAnswer(csv, "postcode") || "";
      const selfReported = getQualAnswer(csv, "travel") || getQualAnswer(csv, "long");
      const selfMin = selfReported ? parseInt(selfReported) || null : null;
      const dist = distances ? distances[i] : null;

      const commuteReasonParts: string[] = [];
      if (postcode) commuteReasonParts.push(`${postcode} → ${job.location || "job"}`);
      if (selfMin != null) commuteReasonParts.push(`Self-reported: ${selfMin} min`);
      if (dist?.drivingMinutes != null) commuteReasonParts.push(`Drive: ${dist.drivingMinutes} min`);
      if (dist?.transitMinutes != null) commuteReasonParts.push(`Public transport: ${dist.transitMinutes} min`);
      commuteReasonParts.push(hasLicence ? "Has driving licence" : "No driving licence");

      return {
        candidateName: csv.name,
        candidateEmail: csv.email,
        candidatePhone: csv.phone,
        candidatePostcode: postcode || null,
        overallScore: -1,
        recommendation: "reject" as const,
        commute: {
          viable: false,
          estimatedMinutes: selfMin,
          drivingMinutes: dist?.drivingMinutes ?? null,
          transitMinutes: dist?.transitMinutes ?? null,
          hasDriverLicence: hasLicence,
          reasoning: commuteReasonParts.join(". ") + ".",
        },
        experience: { score: 0, yearsFromCv: 0, yearsFromIndeed: indeedYears, relevantRoles: csv.relevantExperience ? [csv.relevantExperience] : [], reasoning: `Claims ${indeedYears} years on Indeed — no CV to verify.` },
        tenure: { avgYearsPerRole: 0, reasoning: "No CV available." },
        requirementsMet: [] as Array<{ requirement: string; status: string; evidence: string }>,
        redFlags: ["No CV uploaded — cannot verify experience"],
        summary: `No CV to verify. Indeed: ${indeedYears}yr claimed, ${hasLicence ? "drives" : "no licence"}.`,
        source: "csv_only" as const,
      };
    });
  } else {
    // PDFs only
    scoredResults = await scoreCombined({
      csvCandidates: [], pdfCandidates,
      jobTitle: job.title, jobDescription: job.description,
      jobPostcode: job.location || "", requirements: [],
    });
  }

  // Normalise name for matching
  const normName = (x: string) => x.toLowerCase().replace(/[^a-z]/g, "");

  // Load existing candidates for this job
  const existingCandidates = await db
    .select({ id: candidates.id, name: candidates.name, cvData: candidates.cvData, metadataJson: candidates.metadataJson, rankScore: candidates.rankScore })
    .from(candidates)
    .where(eq(candidates.jobId, jobId));

  // Insert or update each scored candidate
  for (const s of scoredResults) {
    const sName = normName(s.candidateName || "");
    if (sName.length < 2) continue;

    // Find matching PDF
    const matchedPdf = pdfCandidates.find((p) => normName(p.name) === sName);

    // Check if candidate already exists in DB
    const existing = existingCandidates.find((e) => {
      const eName = normName(e.name || "");
      return eName === sName || eName.includes(sName) || sName.includes(eName);
    });

    const sAny = s as Record<string, unknown>;
    const metadataJson = {
      commute: sAny.commute ?? null,
      experience: s.experience,
      tenure: s.tenure,
      requirementsMet: s.requirementsMet,
      redFlags: s.redFlags,
      postcode: s.candidatePostcode,
      source: s.source,
    };

    if (existing) {
      // UPDATE existing — merge CV data and score if we have better info
      const updates: Record<string, unknown> = {};

      // Add CV data if we have it and they don't
      if (matchedPdf && !existing.cvData) {
        updates.cvData = matchedPdf.base64;
        updates.cvFilename = matchedPdf.filename;
        updates.cvBlobUrl = `pdf:${matchedPdf.filename}`;
      }

      // Update score if this is a real score (not -1/unverified)
      if (s.overallScore > 0) {
        const existingScore = existing.rankScore ? parseFloat(existing.rankScore) * 10 : 0;

        // Don't downgrade — if existing score is higher and was already combined, keep it
        // Only update if: new score is higher, OR existing had no real score, OR we have new CV data
        const shouldUpdateScore = s.overallScore >= existingScore || existingScore <= 0 || (matchedPdf && !existing.cvData);

        // Always merge metadata to add CV experience data
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const existingMeta = (existing.metadataJson || {}) as any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const newData = s as any;
        const mergedMetadata = {
          ...existingMeta,                              // Keep everything from CSV (commute, postcode, etc.)
          experience: s.experience,                     // Override with CV-verified experience
          tenure: s.tenure,                             // Override with CV-verified tenure
          requirementsMet: s.requirementsMet,
          redFlags: s.redFlags,
          source: "combined",
        };
        // Only override commute if the new data actually has Google Maps times
        if (newData.commute?.drivingMinutes != null || newData.commute?.transitMinutes != null) {
          mergedMetadata.commute = newData.commute;
        }

        updates.metadataJson = mergedMetadata;

        // Recalculate score using existing commute + new experience
        if (shouldUpdateScore) {
          const { getScoringConfig } = await import("@/lib/scoring-config");
          const config = await getScoringConfig();

          // Use existing commute data if new data doesn't have it
          const commuteData = mergedMetadata.commute || {};
          const hasLic = commuteData.hasDriverLicence || false;
          const commuteMin = hasLic
            ? (commuteData.drivingMinutes ?? commuteData.estimatedMinutes)
            : (commuteData.transitMinutes ?? commuteData.estimatedMinutes);

          let commuteScore = 40;
          if (commuteMin != null) {
            if (commuteMin <= config.commute.excellent) commuteScore = 95;
            else if (commuteMin <= config.commute.good) commuteScore = 85;
            else if (commuteMin <= config.commute.acceptable) commuteScore = 70;
            else if (commuteMin <= config.commute.marginal) commuteScore = 45;
            else commuteScore = 20;
          }
          if (hasLic) commuteScore = Math.min(100, commuteScore + config.commute.licenceBonus);
          else commuteScore = Math.max(0, commuteScore - config.commute.licenceBonus);

          const expScore = s.experience?.score ?? 30;
          const tenureAvg = s.tenure?.avgYearsPerRole ?? 0;
          const tenureScore = tenureAvg >= config.tenure.longTenureYears ? 80 : tenureAvg >= config.tenure.jobHopperThreshold ? 60 : 30;
          const reqChecks = s.requirementsMet || [];
          const metCount = reqChecks.filter((r: { status: string }) => r.status === "met").length;
          const reqScore = reqChecks.length > 0 ? (metCount / reqChecks.length) * 100 : 50;

          const recalculated = Math.round(
            commuteScore * config.weights.commute +
            expScore * config.weights.experience +
            tenureScore * config.weights.tenure +
            reqScore * config.weights.requirements
          );

          const rec = recalculated >= 75 ? "strong" : recalculated >= 50 ? "consider" : "reject";

          // Build proper summary
          const strengths: string[] = [];
          const weaknesses: string[] = [];
          if (commuteScore >= 80) strengths.push("short commute");
          else if (commuteScore < 50) weaknesses.push("long commute");
          if (expScore >= 70) strengths.push("strong experience");
          else if (expScore < 40) weaknesses.push("limited experience");
          if (hasLic) strengths.push("drives");
          else weaknesses.push("no licence");
          const flags = s.redFlags || [];
          if (flags.length > 0) weaknesses.push(flags[0]);

          let summary: string;
          if (rec === "strong") summary = `Strong: ${strengths.join(", ")}.`;
          else if (rec === "reject") summary = `Reject: ${weaknesses.join(", ")}.`;
          else {
            const parts: string[] = [];
            if (strengths.length) parts.push(`Pros: ${strengths.join(", ")}`);
            if (weaknesses.length) parts.push(`Cons: ${weaknesses.join(", ")}`);
            summary = parts.join(". ") + ".";
          }

          updates.rankScore = String(recalculated / 10);
          updates.rankReasoning = summary;
          updates.rankFlags = s.redFlags;
          updates.rankedAt = new Date();
        }
      }

      // Update contact info if we have it and they don't
      if (s.candidateEmail) updates.email = s.candidateEmail;
      if (s.candidatePhone) updates.phone = s.candidatePhone;

      if (Object.keys(updates).length > 0) {
        await db.update(candidates).set(updates).where(eq(candidates.id, existing.id));
        newCount++;
      } else {
        duplicateCount++;
      }
    } else {
      // INSERT new candidate
      const fileHash = createHash("sha256")
        .update(`${sName}:${jobId}`)
        .digest("hex");

      try {
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
          metadataJson,
          rankScore: String(s.overallScore / 10),
          rankReasoning: s.summary,
          rankFlags: s.redFlags,
          rankedAt: new Date(),
        });
        newCount++;
      } catch (e) {
        // Unique constraint violation = duplicate
        duplicateCount++;
      }
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
      const allCandidates = await db.select().from(candidates).where(eq(candidates.jobId, jobId));
      const ranked = allCandidates
        .filter((c) => c.rankScore && parseFloat(c.rankScore) >= 7.5)
        .map((c) => ({
          id: c.id, name: c.name, phone: c.phone, email: c.email,
          score: parseFloat(c.rankScore || "0"),
          reasoning: c.rankReasoning || "",
          flags: (c.rankFlags as string[]) || [],
        }));

      if (ranked.length > 0) {
        const appUrl = process.env.AUTH_URL || `https://${process.env.VERCEL_URL || "localhost:3000"}`;
        await sendDigestEmail({
          to: job.recipientEmail, jobTitle: job.title, jobLocation: job.location,
          jobId: job.id, newCount, duplicateCount, candidates: ranked, appUrl,
        });
        await db.update(uploads).set({ digestSentAt: new Date() }).where(eq(uploads.id, upload.id));
      }
    } catch (e) {
      console.error("Digest email failed:", e);
      await db.update(uploads).set({ digestError: e instanceof Error ? e.message : "Unknown" }).where(eq(uploads.id, upload.id));
    }
  }

  // Return all candidates for this job
  const allCandidates = await db.select().from(candidates).where(eq(candidates.jobId, jobId));

  return Response.json({
    newCount,
    duplicateCount,
    candidates: allCandidates.sort(
      (a, b) => parseFloat(b.rankScore || "-1") - parseFloat(a.rankScore || "-1")
    ),
  });
}
