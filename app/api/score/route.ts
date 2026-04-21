export const maxDuration = 60; // Vercel Hobby max is 60s

import type { NextRequest } from "next/server";
import { getJobs, getJobById } from "@/lib/scraper";
import { extractText } from "@/lib/cv-parser";
import { parseCsvCandidates } from "@/lib/csv-parser";
import { scoreCandidate } from "@/lib/claude";
import { scoreCsvCandidates } from "@/lib/csv-scorer";
import { parseExclusionList, isExcluded } from "@/lib/exclusion-list";
import { ScoredCandidate, CandidateError } from "@/lib/types";

const PDF_EXTRACT_TIMEOUT = 10000; // 10s max per PDF extraction
const CLAUDE_TIMEOUT = 15000; // 15s max per Claude call
const MAX_CONCURRENCY = 3; // Lower concurrency to stay within timeout

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s`)), ms)
    ),
  ]);
}

function isCsvFile(filename: string): boolean {
  return filename.toLowerCase().endsWith(".csv");
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const jobId = formData.get("jobId") as string;
    const excludeRaw = (formData.get("excludeList") as string) || "";

    if (!jobId) {
      return Response.json({ error: "jobId is required" }, { status: 400 });
    }

    const jobs = await getJobs();
    const job = getJobById(jobs, jobId);
    if (!job) {
      return Response.json({ error: "Job not found" }, { status: 404 });
    }

    const exclusions = parseExclusionList(excludeRaw);

    const files: File[] = [];
    for (const [key, value] of formData.entries()) {
      if (key === "files" && value instanceof File) {
        files.push(value);
      }
    }

    if (files.length === 0) {
      return Response.json(
        { error: "At least one CV file is required" },
        { status: 400 }
      );
    }

    const results: ScoredCandidate[] = [];
    const errors: CandidateError[] = [];

    const csvFiles = files.filter((f) => isCsvFile(f.name));
    const cvFiles = files.filter((f) => !isCsvFile(f.name));

    // Process CSV files algorithmically (instant)
    for (const csvFile of csvFiles) {
      try {
        const buffer = Buffer.from(await csvFile.arrayBuffer());
        const text = buffer.toString("utf-8");
        const candidates = parseCsvCandidates(text);

        if (candidates.length === 0) {
          errors.push({ filename: csvFile.name, error: "No candidates found in CSV" });
          continue;
        }

        const scored = await scoreCsvCandidates(candidates, job);
        for (const candidate of scored) {
          const filename = `${csvFile.name} — ${candidate.candidateName || "Unknown"}`;

          if (isExcluded(candidate.candidateName, candidate.candidateEmail, exclusions)) {
            results.push({
              ...candidate,
              filename,
              overallScore: 0,
              recommendation: "reject",
              redFlags: [...candidate.redFlags, "On exclusion list"],
              summary: "Candidate is on the exclusion list.",
            });
          } else {
            results.push({ ...candidate, filename });
          }
        }
      } catch (e) {
        errors.push({
          filename: csvFile.name,
          error: e instanceof Error ? e.message : "Failed to parse CSV",
        });
      }
    }

    // Process individual CV files with per-file timeouts
    if (cvFiles.length > 0) {
      // Process in smaller concurrent batches to avoid timeout
      const executing: Promise<void>[] = [];

      for (const file of cvFiles) {
        const task = (async () => {
          try {
            const buffer = Buffer.from(await file.arrayBuffer());

            // Timeout on PDF extraction (some scanned PDFs take forever)
            const text = await withTimeout(
              extractText(buffer, file.name),
              PDF_EXTRACT_TIMEOUT,
              `PDF extraction for ${file.name}`
            );

            // Timeout on Claude scoring
            const scored = await withTimeout(
              scoreCandidate(job, text),
              CLAUDE_TIMEOUT,
              `Scoring ${file.name}`
            );

            if (isExcluded(scored.candidateName, scored.candidateEmail, exclusions)) {
              results.push({
                ...scored,
                filename: file.name,
                overallScore: 0,
                recommendation: "reject",
                redFlags: [...scored.redFlags, "On exclusion list"],
                summary: "Candidate is on the exclusion list.",
              });
            } else {
              results.push({ ...scored, filename: file.name });
            }
          } catch (e) {
            errors.push({
              filename: file.name,
              error: e instanceof Error ? e.message : "Unknown error",
            });
          }
        })();

        executing.push(task);

        // Cap concurrency
        if (executing.length >= MAX_CONCURRENCY) {
          await Promise.race(executing);
          // Remove completed
          for (let i = executing.length - 1; i >= 0; i--) {
            const settled = await Promise.race([
              executing[i].then(() => true),
              Promise.resolve(false),
            ]);
            if (settled) executing.splice(i, 1);
          }
        }
      }

      await Promise.all(executing);
    }

    results.sort((a, b) => b.overallScore - a.overallScore);

    return Response.json({ job, results, errors });
  } catch (error) {
    console.error("Scoring error:", error);
    return Response.json(
      { error: "An error occurred while scoring candidates" },
      { status: 500 }
    );
  }
}
