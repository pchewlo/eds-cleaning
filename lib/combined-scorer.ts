import Anthropic from "@anthropic-ai/sdk";
import { CsvCandidate, candidateToText } from "./csv-parser";
import { getDistancesBatch, DistanceResult } from "./distance";
import { getScoringConfig, ScoringConfig, DEFAULT_CONFIG } from "./scoring-config";

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

// Prompt loaded from config at runtime

// Batch extract structured data from CVs using Haiku (fast + cheap)
async function extractCvDataBatch(
  batch: Array<{ id: string; cvText: string }>,
  extractionPrompt: string
): Promise<Array<{
  id: string;
  name: string;
  roles: Array<{ title: string; employer: string; startYear: number; endYear: number; isCleaning: boolean; isRelevant: boolean }>;
  hasDriverLicence: boolean | null;
  postcode: string | null;
  redFlags: string[];
}>> {
  const candidateBlocks = batch
    .map((c) => `### Candidate (ID: ${c.id})\n${c.cvText.slice(0, 4000)}`)
    .join("\n---\n");

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 4000,
    temperature: 0,
    system: extractionPrompt,
    messages: [{
      role: "user",
      content: `Extract work history from these ${batch.length} CVs. Return a JSON array.\n\n${candidateBlocks}`,
    }],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  const cleaned = text.replace(/^```json?\s*\n?/i, "").replace(/\n?```\s*$/i, "");
  return JSON.parse(cleaned);
}

// Score extracted CV data algorithmically (no LLM needed)
function scoreCvData(extracted: {
  roles: Array<{ title: string; employer: string; startYear: number; endYear: number; isCleaning: boolean; isRelevant: boolean }>;
  hasDriverLicence: boolean | null;
  redFlags: string[];
}): ClaudeResult & { relevantRoleStrings: string[] } {
  const currentYear = new Date().getFullYear();
  const roles = extracted.roles || [];

  // Calculate years of relevant experience
  let relevantYears = 0;
  const relevantRoleStrings: string[] = [];
  for (const r of roles) {
    const end = r.endYear || currentYear;
    const years = Math.max(0, end - (r.startYear || end));
    if (r.isCleaning || r.isRelevant) {
      relevantYears += years;
      relevantRoleStrings.push(`${r.title}, ${r.employer} (${r.startYear || "?"}–${r.endYear || "present"})`);
    }
  }

  // Experience score
  const cleaningRoles = roles.filter((r) => r.isCleaning);
  const relevantRoles = roles.filter((r) => r.isRelevant);
  let expScore = Math.min(100, relevantYears * 12);
  if (cleaningRoles.length > 0) expScore = Math.min(100, expScore + 15);
  else if (relevantRoles.length > 0) expScore = Math.min(100, expScore + 5);

  // Tenure
  const roleDurations = roles.map((r) => Math.max(0.5, (r.endYear || currentYear) - (r.startYear || currentYear)));
  const avgTenure = roleDurations.length > 0
    ? roleDurations.reduce((a, b) => a + b, 0) / roleDurations.length
    : 0;

  // Check for long tenures (bonus) and job hopping (penalty)
  const longTenure = roleDurations.some((d) => d >= 5);
  if (longTenure) expScore = Math.min(100, expScore + 10);
  if (avgTenure < 1.5 && roles.length >= 3) {
    expScore = Math.max(0, expScore - 15);
  }

  // Build reasoning
  const reasonParts: string[] = [];
  if (cleaningRoles.length > 0) {
    reasonParts.push(`${cleaningRoles.length} cleaning role${cleaningRoles.length > 1 ? "s" : ""} found on CV`);
  }
  if (relevantYears > 0) {
    reasonParts.push(`${relevantYears} years relevant experience`);
  }
  if (longTenure) {
    reasonParts.push("shows long-term commitment");
  }
  if (avgTenure < 1.5 && roles.length >= 3) {
    reasonParts.push("frequent job changes");
  }

  const tenureReasoning = avgTenure > 0
    ? `Average ${avgTenure.toFixed(1)} years per role across ${roles.length} positions.${longTenure ? " Has at least one long-term role (5+ years)." : ""}${avgTenure < 1.5 && roles.length >= 3 ? " Pattern of short tenures." : ""}`
    : "No employment history available.";

  return {
    id: "",
    experienceScore: expScore,
    yearsRelevant: relevantYears,
    relevantRoles: relevantRoleStrings,
    experienceReasoning: reasonParts.join(". ") + "." || "No relevant experience found on CV.",
    tenureAvgYears: parseFloat(avgTenure.toFixed(1)),
    tenureReasoning,
    redFlags: extracted.redFlags || [],
    requirementChecks: [],
    relevantRoleStrings,
  };
}

// Extract + score all CVs: Haiku for extraction (fast), algorithmic for scoring (instant)
async function scoreAllCvs(
  candidates: Array<{ id: string; cvText: string }>,
  config: ScoringConfig
): Promise<Map<string, ClaudeResult>> {
  const results = new Map<string, ClaudeResult>();
  const BATCH_SIZE = 5;  // Haiku can handle bigger batches
  const CONCURRENCY = 4; // Haiku is fast, run more concurrent
  const batches: Array<Array<{ id: string; cvText: string }>> = [];

  for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
    batches.push(candidates.slice(i, i + BATCH_SIZE));
  }

  for (let i = 0; i < batches.length; i += CONCURRENCY) {
    const concurrent = batches.slice(i, i + CONCURRENCY).map(async (batch) => {
      try {
        const extracted = await extractCvDataBatch(batch, config.extractionPrompt);
        for (const ex of extracted) {
          const scored = scoreCvData(ex);
          scored.id = ex.id;
          results.set(ex.id, scored);
        }
      } catch (e) {
        console.error("Haiku extraction failed:", e instanceof Error ? e.message : e);
        for (const c of batch) {
          results.set(c.id, {
            id: c.id, experienceScore: 30, yearsRelevant: 0, relevantRoles: [],
            experienceReasoning: "CV extraction failed", tenureAvgYears: 0,
            tenureReasoning: "CV extraction failed", redFlags: ["extraction error"],
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

  // Load scoring config
  const config = await getScoringConfig();

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

  // 2. Extract data from all PDFs via Haiku (fast) + score algorithmically
  const claudeResults = pdfCandidates.length > 0
    ? await scoreAllCvs(
        pdfCandidates.map((p, i) => ({ id: String(i), cvText: p.cvText })),
        config
      )
    : new Map<string, ClaudeResult>();

  // 2b. Get distances for PDF-only candidates using Haiku-extracted postcodes
  const pdfPostcodes: Array<{ index: number; postcode: string }> = [];
  for (let pi = 0; pi < pdfCandidates.length; pi++) {
    const csvMatch = matchPdfToCsv(pdfCandidates[pi].name, csvCandidates);
    if (!csvMatch) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const hData = claudeResults.get(String(pi)) as any;
      if (hData?.postcode) {
        pdfPostcodes.push({ index: pi, postcode: hData.postcode });
      }
    }
  }
  let pdfDistances: Map<number, { drivingMinutes: number | null; transitMinutes: number | null }> = new Map();
  if (pdfPostcodes.length > 0 && jobPostcode) {
    try {
      const pdfDist = await getDistancesBatch(pdfPostcodes.map(p => p.postcode), jobPostcode);
      pdfPostcodes.forEach((p, i) => {
        pdfDistances.set(p.index, { drivingMinutes: pdfDist[i]?.drivingMinutes ?? null, transitMinutes: pdfDist[i]?.transitMinutes ?? null });
      });
    } catch (e) {
      console.error("PDF distance lookup failed:", e);
    }
  }

  // 3. Match PDFs to CSV candidates and build results
  const results: CombinedResult[] = [];
  const matchedCsvIndices = new Set<number>();

  for (let pi = 0; pi < pdfCandidates.length; pi++) {
    const pdf = pdfCandidates[pi];
    const csvMatch = matchPdfToCsv(pdf.name, csvCandidates);
    const csvIndex = csvMatch ? csvCandidates.indexOf(csvMatch) : -1;
    if (csvIndex >= 0) matchedCsvIndices.add(csvIndex);

    const claudeResult = claudeResults.get(String(pi)) || null;

    // Build commute from CSV metadata (if matched), or fall back to CV-extracted data
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const haikuData = claudeResult as any;
    const hasLicence = csvMatch
      ? getQualificationAnswer(csvMatch, "driving")?.toLowerCase() === "yes"
      : haikuData?.hasDriverLicence === true;
    const selfReported = csvMatch
      ? parseMinutes(getQualificationAnswer(csvMatch, "travel") || getQualificationAnswer(csvMatch, "long"))
      : null;
    const distance = csvIndex >= 0 && distances
      ? distances[csvIndex]
      : pdfDistances.get(pi) || null;
    const postcode = csvMatch
      ? getQualificationAnswer(csvMatch, "postcode") || ""
      : haikuData?.postcode || "";

    const drivingMin = distance?.drivingMinutes ?? null;
    const transitMin = distance?.transitMinutes ?? null;
    const commuteMin = hasLicence ? (drivingMin ?? selfReported) : (transitMin ?? selfReported);

    let commuteScore = 40;
    let commuteViable = false;
    if (commuteMin !== null) {
      if (commuteMin <= config.commute.excellent) { commuteScore = 95; commuteViable = true; }
      else if (commuteMin <= config.commute.good) { commuteScore = 85; commuteViable = true; }
      else if (commuteMin <= config.commute.acceptable) { commuteScore = 70; commuteViable = true; }
      else if (commuteMin <= config.commute.marginal) { commuteScore = 45; commuteViable = false; }
      else { commuteScore = 20; commuteViable = false; }
    }
    if (hasLicence) commuteScore = Math.min(100, commuteScore + config.commute.licenceBonus);
    else commuteScore = Math.max(0, commuteScore - config.commute.licenceBonus);

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

    const overall = Math.round(
      commuteScore * config.weights.commute +
      expScore * config.weights.experience +
      tenureScore * config.weights.tenure +
      reqScore * config.weights.requirements
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
      if (commuteMin <= config.commute.excellent) { commuteScore = 95; commuteViable = true; }
      else if (commuteMin <= config.commute.good) { commuteScore = 85; commuteViable = true; }
      else if (commuteMin <= config.commute.acceptable) { commuteScore = 70; commuteViable = true; }
      else if (commuteMin <= config.commute.marginal) { commuteScore = 45; commuteViable = false; }
      else { commuteScore = 20; commuteViable = false; }
    }
    if (hasLicence) commuteScore = Math.min(100, commuteScore + config.commute.licenceBonus);
    else commuteScore = Math.max(0, commuteScore - config.commute.licenceBonus);

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
