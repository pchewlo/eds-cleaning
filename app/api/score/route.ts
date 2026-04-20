export const maxDuration = 60; // Vercel Hobby max is 60s

import type { NextRequest } from "next/server";
import { getJobs, getJobById } from "@/lib/scraper";
import { extractText } from "@/lib/cv-parser";
import { parseCsvCandidates } from "@/lib/csv-parser";
import { scoreCandidate, scoreCsvBatch } from "@/lib/claude";
import { parseExclusionList, isExcluded } from "@/lib/exclusion-list";
import { ScoredCandidate, CandidateError } from "@/lib/types";

const MAX_CONCURRENCY = 5;
const CSV_BATCH_SIZE = 15; // Max candidates per Claude call

async function withConcurrency<T>(
  tasks: (() => Promise<T>)[],
  limit: number
): Promise<T[]> {
  const results: T[] = [];
  const executing: Set<Promise<void>> = new Set();

  for (const task of tasks) {
    const p = (async () => {
      const r = await task();
      results.push(r);
    })();
    executing.add(p);
    p.then(() => executing.delete(p));

    if (executing.size >= limit) {
      await Promise.race(executing);
    }
  }

  await Promise.all(executing);
  return results;
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

    // Separate CSV files from individual CV files
    const csvFiles = files.filter((f) => isCsvFile(f.name));
    const cvFiles = files.filter((f) => !isCsvFile(f.name));

    // Process CSV files as batches
    for (const csvFile of csvFiles) {
      try {
        const buffer = Buffer.from(await csvFile.arrayBuffer());
        const text = buffer.toString("utf-8");
        const candidates = parseCsvCandidates(text);

        if (candidates.length === 0) {
          errors.push({ filename: csvFile.name, error: "No candidates found in CSV" });
          continue;
        }

        // Process in batches to stay within token limits
        for (let i = 0; i < candidates.length; i += CSV_BATCH_SIZE) {
          const batch = candidates.slice(i, i + CSV_BATCH_SIZE);
          try {
            const scored = await scoreCsvBatch(job, batch);
            for (let j = 0; j < scored.length; j++) {
              const candidate = scored[j];
              const csvCandidate = batch[j];
              const filename = `${csvFile.name} — ${candidate.candidateName || csvCandidate?.name || `Row ${i + j + 1}`}`;

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
              filename: `${csvFile.name} (rows ${i + 1}-${i + batch.length})`,
              error: e instanceof Error ? e.message : "Unknown error",
            });
          }
        }
      } catch (e) {
        errors.push({
          filename: csvFile.name,
          error: e instanceof Error ? e.message : "Failed to parse CSV",
        });
      }
    }

    // Process individual CV files (PDF/DOCX/TXT)
    if (cvFiles.length > 0) {
      const tasks = cvFiles.map((file) => async () => {
        try {
          const buffer = Buffer.from(await file.arrayBuffer());
          const text = await extractText(buffer, file.name);
          const scored = await scoreCandidate(job, text);

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
      });

      await withConcurrency(tasks, MAX_CONCURRENCY);
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
