import Anthropic from "@anthropic-ai/sdk";
import { CsvCandidate, candidateToText } from "./csv-parser";
import { getDistancesBatch, DistanceResult } from "./distance";

const client = new Anthropic();

function getQualificationAnswer(candidate: CsvCandidate, keyword: string): string | undefined {
  const q = candidate.qualifications.find(
    (qual) => qual.question.toLowerCase().includes(keyword.toLowerCase())
  );
  return q?.answer;
}

function parseMinutes(text: string | undefined): number | null {
  if (!text) return null;
  const match = text.match(/(\d+)/);
  return match ? parseInt(match[1]) : null;
}

export interface CombinedResult {
  candidateName: string;
  candidateEmail: string | null;
  candidatePhone: string | null;
  candidatePostcode: string | null;
  overallScore: number;
  recommendation: "strong" | "consider" | "reject";
  commute: {
    viable: boolean;
    estimatedMinutes: number | null;
    drivingMinutes: number | null;
    transitMinutes: number | null;
    hasDriverLicence: boolean;
    reasoning: string;
  };
  experience: {
    score: number;
    yearsFromCv: number;
    yearsFromIndeed: number;
    relevantRoles: string[];
    reasoning: string;
  };
  tenure: {
    avgYearsPerRole: number;
    reasoning: string;
  };
  requirementsMet: Array<{
    requirement: string;
    status: "met" | "not_met" | "unclear";
    evidence: string;
  }>;
  redFlags: string[];
  summary: string;
  source: "combined" | "csv_only" | "pdf_only";
}

// Match PDFs to CSV candidates by normalised name
function matchPdfToCsv(
  pdfName: string,
  csvCandidates: CsvCandidate[]
): CsvCandidate | null {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");
  const pdfNorm = norm(pdfName);

  for (const csv of csvCandidates) {
    if (norm(csv.name) === pdfNorm) return csv;
    // Partial match — first+last name in either order
    const pdfParts = pdfNorm.split(/\s+/).filter(Boolean);
    const csvParts = norm(csv.name).split(/\s+/).filter(Boolean);
    if (pdfParts.length >= 2 && csvParts.length >= 2) {
      if (pdfParts[0] === csvParts[0] && pdfParts[pdfParts.length - 1] === csvParts[csvParts.length - 1]) {
        return csv;
      }
    }
  }
  return null;
}

type ClaudeResult = {
  id: string;
  experienceScore: number;
  yearsRelevant: number;
  relevantRoles: string[];
  experienceReasoning: string;
  tenureAvgYears: number;
  tenureReasoning: string;
  redFlags: string[];
  requirementChecks: Array<{ requirement: string; status: string; evidence: string }>;
};

const CLAUDE_SYSTEM = `You assess CVs for cleaning roles. Return JSON only, no markdown fencing.

Score experience 0-100:
- Strong: commercial/domestic cleaning, janitorial, housekeeping, domestic assistant, caretaker
- Strong relevant: care worker, school worker, NHS worker
- Relevant: hospitality, retail, warehouse, kitchen porter
- Weaker: office/admin roles
- IMPORTANT: Long tenure in a single role (5+ years) is very positive. Job hopping (<1.5yr avg) = red flag.

For each candidate return: id, experienceScore (0-100), yearsRelevant, relevantRoles[], experienceReasoning (1 sentence), tenureAvgYears, tenureReasoning (1 sentence), redFlags[], requirementChecks[{requirement, status, evidence}].`;

// Batch score up to 5 CVs in one Claude call
async function scoreCvBatchWithClaude(
  batch: Array<{ id: string; cvText: string }>,
  jobTitle: string,
  jobDescription: string
): Promise<ClaudeResult[]> {
  const candidateBlocks = batch
    .map((c) => `### Candidate (ID: ${c.id})\n${c.cvText.slice(0, 3000)}`)
    .join("\n---\n");

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4000,
    temperature: 0,
    system: CLAUDE_SYSTEM,
    messages: [{
      role: "user",
      content: `Job: ${jobTitle}\n${jobDescription}\n\n${candidateBlocks}\n\nReturn a JSON array with one object per candidate, same order. Each must have: id, experienceScore, yearsRelevant, relevantRoles, experienceReasoning, tenureAvgYears, tenureReasoning, redFlags, requirementChecks.`,
    }],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  const cleaned = text.replace(/^```json?\s*\n?/i, "").replace(/\n?```\s*$/i, "");
  return JSON.parse(cleaned);
}

// Score all PDFs in batches of 5, with concurrency of 2 batches
async function scoreAllCvsWithClaude(
  candidates: Array<{ id: string; cvText: string }>,
  jobTitle: string,
  jobDescription: string
): Promise<Map<string, ClaudeResult>> {
  const results = new Map<string, ClaudeResult>();
  const BATCH_SIZE = 3;
  const CONCURRENCY = 3;
  const batches: Array<Array<{ id: string; cvText: string }>> = [];

  for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
    batches.push(candidates.slice(i, i + BATCH_SIZE));
  }

  // Process batches concurrently
  for (let i = 0; i < batches.length; i += CONCURRENCY) {
    const concurrent = batches.slice(i, i + CONCURRENCY).map(async (batch) => {
      try {
        const scored = await scoreCvBatchWithClaude(batch, jobTitle, jobDescription);
        for (const s of scored) {
          results.set(s.id, s);
        }
      } catch (e) {
        console.error("Batch scoring failed:", e instanceof Error ? e.message : e);
        // Individual fallback scores
        for (const c of batch) {
          results.set(c.id, {
            id: c.id, experienceScore: 30, yearsRelevant: 0, relevantRoles: [],
            experienceReasoning: "Scoring failed", tenureAvgYears: 0,
            tenureReasoning: "Scoring failed", redFlags: ["scoring error"],
            requirementChecks: [],
          });
        }
      }
    });
    await Promise.all(concurrent);
  }

  return results;
}

// Main combined scoring function
export async function scoreCombined(params: {
  csvCandidates: CsvCandidate[];
  pdfCandidates: Array<{ filename: string; name: string; cvText: string }>;
  jobTitle: string;
  jobDescription: string;
  jobPostcode: string;
  requirements: string[];
}): Promise<CombinedResult[]> {
  const { csvCandidates, pdfCandidates, jobTitle, jobDescription, jobPostcode, requirements } = params;

  // 1. Get Google Maps distances for all CSV candidates
  const postcodes = csvCandidates.map(
    (c) => getQualificationAnswer(c, "postcode") || c.location || ""
  );
  let distances: DistanceResult[] | null = null;
  try {
    distances = await getDistancesBatch(postcodes, jobPostcode);
  } catch (e) {
    console.error("Distance lookup failed:", e);
  }

  // 2. Batch score all PDFs with Claude (5 at a time, 2 concurrent batches)
  const claudeResults = pdfCandidates.length > 0
    ? await scoreAllCvsWithClaude(
        pdfCandidates.map((p, i) => ({ id: String(i), cvText: p.cvText })),
        jobTitle,
        jobDescription
      )
    : new Map<string, ClaudeResult>();

  // 3. Match PDFs to CSV candidates and build results
  const results: CombinedResult[] = [];
  const matchedCsvIndices = new Set<number>();

  for (let pi = 0; pi < pdfCandidates.length; pi++) {
    const pdf = pdfCandidates[pi];
    const csvMatch = matchPdfToCsv(pdf.name, csvCandidates);
    const csvIndex = csvMatch ? csvCandidates.indexOf(csvMatch) : -1;
    if (csvIndex >= 0) matchedCsvIndices.add(csvIndex);

    const claudeResult = claudeResults.get(String(pi)) || null;

    // Build commute from CSV metadata (if matched)
    const hasLicence = csvMatch
      ? getQualificationAnswer(csvMatch, "driving")?.toLowerCase() === "yes"
      : false;
    const selfReported = csvMatch
      ? parseMinutes(getQualificationAnswer(csvMatch, "travel") || getQualificationAnswer(csvMatch, "long"))
      : null;
    const distance = csvIndex >= 0 && distances ? distances[csvIndex] : null;
    const postcode = csvMatch ? getQualificationAnswer(csvMatch, "postcode") || "" : "";

    const drivingMin = distance?.drivingMinutes ?? null;
    const transitMin = distance?.transitMinutes ?? null;
    const commuteMin = hasLicence ? (drivingMin ?? selfReported) : (transitMin ?? selfReported);

    let commuteScore = 40;
    let commuteViable = false;
    if (commuteMin !== null) {
      if (commuteMin <= 15) { commuteScore = 95; commuteViable = true; }
      else if (commuteMin <= 20) { commuteScore = 85; commuteViable = true; }
      else if (commuteMin <= 30) { commuteScore = 70; commuteViable = true; }
      else if (commuteMin <= 45) { commuteScore = 45; commuteViable = false; }
      else { commuteScore = 20; commuteViable = false; }
    }
    if (hasLicence) commuteScore = Math.min(100, commuteScore + 10);
    else commuteScore = Math.max(0, commuteScore - 10);

    const expScore = claudeResult?.experienceScore ?? 30;
    const indeedYears = csvMatch
      ? parseInt(getQualificationAnswer(csvMatch, "cleaning experience") || "0") || 0
      : 0;

    // Requirements
    const reqChecks = claudeResult?.requirementChecks || [];
    const metCount = reqChecks.filter((r) => r.status === "met").length;
    const reqScore = reqChecks.length > 0 ? (metCount / reqChecks.length) * 100 : 50;

    // Tenure
    const tenureScore = claudeResult
      ? (claudeResult.tenureAvgYears >= 3 ? 80 : claudeResult.tenureAvgYears >= 1.5 ? 60 : 30)
      : 50;

    // Overall: Commute 25%, Experience 35%, Tenure 25%, Requirements 15%
    const overall = Math.round(
      commuteScore * 0.25 +
      expScore * 0.35 +
      tenureScore * 0.25 +
      reqScore * 0.15
    );

    const recommendation = overall >= 75 ? "strong" : overall >= 50 ? "consider" : "reject";

    const commuteReasonParts = [];
    if (postcode) commuteReasonParts.push(`${postcode} → ${jobPostcode}`);
    if (selfReported != null) commuteReasonParts.push(`Self-reported: ${selfReported} min`);
    if (drivingMin != null) commuteReasonParts.push(`Drive: ${drivingMin} min`);
    if (transitMin != null) commuteReasonParts.push(`Public transport: ${transitMin} min`);
    commuteReasonParts.push(hasLicence ? "Has driving licence" : "No driving licence");

    results.push({
      candidateName: pdf.name || csvMatch?.name || "Unknown",
      candidateEmail: csvMatch?.email || null,
      candidatePhone: csvMatch?.phone || null,
      candidatePostcode: postcode || null,
      overallScore: overall,
      recommendation,
      commute: {
        viable: commuteViable,
        estimatedMinutes: selfReported,
        drivingMinutes: drivingMin,
        transitMinutes: transitMin,
        hasDriverLicence: hasLicence,
        reasoning: commuteReasonParts.join(". ") + ".",
      },
      experience: {
        score: expScore,
        yearsFromCv: claudeResult?.yearsRelevant ?? 0,
        yearsFromIndeed: indeedYears,
        relevantRoles: claudeResult?.relevantRoles ?? [],
        reasoning: claudeResult?.experienceReasoning ?? "No CV data available.",
      },
      tenure: {
        avgYearsPerRole: claudeResult?.tenureAvgYears ?? 0,
        reasoning: claudeResult?.tenureReasoning ?? "No CV data available.",
      },
      requirementsMet: (reqChecks as CombinedResult["requirementsMet"]) || [],
      redFlags: claudeResult?.redFlags ?? [],
      summary: buildSummary(overall, recommendation, commuteScore, expScore, hasLicence, claudeResult?.redFlags || []),
      source: csvMatch ? "combined" : "pdf_only",
    });
  }

  // 3. Add CSV-only candidates (no matching PDF)
  for (let i = 0; i < csvCandidates.length; i++) {
    if (matchedCsvIndices.has(i)) continue;

    const csv = csvCandidates[i];
    const hasLicence = getQualificationAnswer(csv, "driving")?.toLowerCase() === "yes";
    const selfReported = parseMinutes(getQualificationAnswer(csv, "travel") || getQualificationAnswer(csv, "long"));
    const distance = distances ? distances[i] : null;
    const postcode = getQualificationAnswer(csv, "postcode") || "";
    const indeedYears = parseInt(getQualificationAnswer(csv, "cleaning experience") || "0") || 0;

    const drivingMin = distance?.drivingMinutes ?? null;
    const transitMin = distance?.transitMinutes ?? null;
    const commuteMin = hasLicence ? (drivingMin ?? selfReported) : (transitMin ?? selfReported);

    let commuteScore = 40;
    let commuteViable = false;
    if (commuteMin !== null) {
      if (commuteMin <= 15) { commuteScore = 95; commuteViable = true; }
      else if (commuteMin <= 20) { commuteScore = 85; commuteViable = true; }
      else if (commuteMin <= 30) { commuteScore = 70; commuteViable = true; }
      else if (commuteMin <= 45) { commuteScore = 45; commuteViable = false; }
      else { commuteScore = 20; commuteViable = false; }
    }
    if (hasLicence) commuteScore = Math.min(100, commuteScore + 10);
    else commuteScore = Math.max(0, commuteScore - 10);

    // No CV — cannot score reliably. Set to -1 to sort to bottom.
    const commuteReasonParts = [];
    if (postcode) commuteReasonParts.push(`${postcode} → ${jobPostcode}`);
    if (selfReported != null) commuteReasonParts.push(`Self-reported: ${selfReported} min`);
    if (drivingMin != null) commuteReasonParts.push(`Drive: ${drivingMin} min`);
    if (transitMin != null) commuteReasonParts.push(`Public transport: ${transitMin} min`);
    commuteReasonParts.push(hasLicence ? "Has driving licence" : "No driving licence");

    results.push({
      candidateName: csv.name,
      candidateEmail: csv.email,
      candidatePhone: csv.phone,
      candidatePostcode: postcode || null,
      overallScore: -1, // No score — no CV to verify
      recommendation: "reject",
      commute: {
        viable: commuteViable,
        estimatedMinutes: selfReported,
        drivingMinutes: drivingMin,
        transitMinutes: transitMin,
        hasDriverLicence: hasLicence,
        reasoning: commuteReasonParts.join(". ") + ".",
      },
      experience: {
        score: 0,
        yearsFromCv: 0,
        yearsFromIndeed: indeedYears,
        relevantRoles: csv.relevantExperience ? [csv.relevantExperience] : [],
        reasoning: `Claims ${indeedYears} years on Indeed — no CV uploaded to verify.`,
      },
      tenure: {
        avgYearsPerRole: 0,
        reasoning: "No CV available.",
      },
      requirementsMet: [],
      redFlags: ["No CV uploaded — cannot verify experience"],
      summary: `No CV to verify. Indeed data: ${indeedYears}yr claimed, ${hasLicence ? "has licence" : "no licence"}, ${commuteMin ? commuteMin + "min commute" : "unknown commute"}.`,
      source: "csv_only",
    });
  }

  return results.sort((a, b) => b.overallScore - a.overallScore);
}

function buildSummary(
  overall: number,
  rec: string,
  commuteScore: number,
  expScore: number,
  hasLicence: boolean,
  redFlags: string[]
): string {
  const strengths: string[] = [];
  const weaknesses: string[] = [];

  if (commuteScore >= 80) strengths.push("short commute");
  else if (commuteScore < 50) weaknesses.push("long commute");

  if (expScore >= 70) strengths.push("strong experience");
  else if (expScore < 40) weaknesses.push("limited experience");

  if (hasLicence) strengths.push("drives");
  else weaknesses.push("no licence");

  if (redFlags.length > 0) weaknesses.push(...redFlags.slice(0, 1));

  if (rec === "strong") return `Strong: ${strengths.join(", ")}.`;
  if (rec === "reject") return `Reject: ${weaknesses.join(", ")}.`;
  const parts = [];
  if (strengths.length) parts.push(`Pros: ${strengths.join(", ")}`);
  if (weaknesses.length) parts.push(`Cons: ${weaknesses.join(", ")}`);
  return parts.join(". ") + ".";
}
