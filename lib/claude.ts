import Anthropic from "@anthropic-ai/sdk";
import { Job, ScoredCandidate } from "./types";
import { CsvCandidate, candidateToText } from "./csv-parser";

const client = new Anthropic();

const SYSTEM_PROMPT = `You are a recruitment screening assistant for Minster Cleaning, a UK commercial cleaning company. You help area managers quickly triage CV applications for specific open cleaning roles.

Score candidates against the specific job provided using these criteria:

1. COMMUTE VIABILITY — Can they realistically get to the job site for the shift hours?
   - Use UK postcode geography: adjacent postcodes (same first part, e.g. S40/S41) are usually 10–20 min apart. Different towns can be 30+ mins.
   - If shift starts before 7am, assume no buses — the candidate needs a car.
   - Short shifts (2–3 hrs) with long commutes are unattractive; flag if commute > 50% of shift length.

2. RELEVANT EXPERIENCE — What counts as relevant:
   - Strong: commercial cleaning, domestic cleaning, janitorial, housekeeping, domestic assistant, caretaker
   - Strong relevant: care worker, school worker, NHS worker — these backgrounds transfer very well to cleaning
   - Relevant: hospitality, retail, warehouse, kitchen porter, similar hands-on service roles
   - Weaker: office/professional/admin roles with no physical work component
   - Count years across all relevant roles in the last 5-10 years.
   - IMPORTANT: Long tenure in a single role is a very strong positive signal. Someone who stayed 12 years in one role is far more valuable than someone with 12 separate one-year jobs, even if total years are the same.

3. JOB TENURE — Minster strongly values people who stay in roles long-term.
   - Long single-role tenure (5+ years in one job) = very strong positive signal — weight this heavily.
   - Average under 1.5 years per role = red flag (job hopper).
   - 6–12 month stints repeatedly = red flag.
   - Unexplained multi-year gaps = soft red flag.

4. JOB-SPECIFIC REQUIREMENTS — For any "must have" requirements in the job description, evaluate objectively. If the CV doesn't mention it either way, mark "unclear".

OUTPUT: Return valid JSON only. No preamble, no markdown fencing, no explanation outside the JSON.

Overall score weighting:
- Commute: 30%
- Experience: 30%
- Tenure: 25%
- Requirements: 15%

Recommendation thresholds:
- 75-100 = "strong"
- 50-74 = "consider"
- 0-49 = "reject"`;

function buildUserPrompt(job: Job, cvText: string): string {
  const requirementsList =
    job.requirements.length > 0
      ? job.requirements.map((r) => `- ${r}`).join("\n")
      : "None stated";

  return `## Job details
Title: ${job.title}
Location: ${job.location}
Postcode: ${job.postcode}
Shift pattern: ${job.shiftPattern}
Hours per week: ${job.hoursPerWeek}
Hourly rate: ${job.hourlyRate}

## Full job description
${job.fullDescription}

## Must-have requirements
${requirementsList}

---

## Candidate CV
${cvText}

---

Return a JSON object matching this exact schema:

{
  "candidateName": string,
  "candidatePostcode": string | null,
  "candidateEmail": string | null,
  "candidatePhone": string | null,
  "overallScore": number,
  "recommendation": "strong" | "consider" | "reject",
  "commute": {
    "viable": boolean,
    "estimatedMinutes": number | null,
    "hasDriverLicence": boolean | null,
    "reasoning": string
  },
  "experience": {
    "score": number,
    "yearsOfRelevantWork": number,
    "relevantRoles": string[],
    "reasoning": string
  },
  "tenure": {
    "score": number,
    "avgYearsPerRole": number,
    "rolesInLast5Years": number,
    "reasoning": string
  },
  "requirementsMet": [
    { "requirement": string, "status": "met" | "not_met" | "unclear", "evidence": string }
  ],
  "redFlags": string[],
  "summary": string
}`;
}

export async function scoreCandidate(
  job: Job,
  cvText: string,
  retryCount = 0
): Promise<ScoredCandidate> {
  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2000,
    temperature: 0,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildUserPrompt(job, cvText) }],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";

  try {
    const cleaned = text.replace(/^```json?\s*\n?/i, "").replace(/\n?```\s*$/i, "");
    const parsed = JSON.parse(cleaned) as ScoredCandidate;
    // Ensure new fields have defaults
    parsed.commute.drivingMinutes = parsed.commute.drivingMinutes ?? null;
    parsed.commute.transitMinutes = parsed.commute.transitMinutes ?? null;
    return parsed;
  } catch {
    if (retryCount < 1) {
      return scoreCandidate(job, cvText, retryCount + 1);
    }
    throw new Error(`Failed to parse Claude response as JSON: ${text.slice(0, 200)}`);
  }
}

export async function scoreCsvBatch(
  job: Job,
  candidates: CsvCandidate[],
  retryCount = 0
): Promise<ScoredCandidate[]> {
  const candidateBlocks = candidates
    .map((c, i) => `### Candidate ${i + 1}\n${candidateToText(c)}`)
    .join("\n---\n");

  const requirementsList =
    job.requirements.length > 0
      ? job.requirements.map((r) => `- ${r}`).join("\n")
      : "None stated";

  const userPrompt = `## Job details
Title: ${job.title}
Location: ${job.location}
Postcode: ${job.postcode}
Shift pattern: ${job.shiftPattern}
Hours per week: ${job.hoursPerWeek}
Hourly rate: ${job.hourlyRate}

## Full job description
${job.fullDescription}

## Must-have requirements
${requirementsList}

---

## Candidates (${candidates.length} total)
${candidateBlocks}

---

Score ALL ${candidates.length} candidates. Return a JSON array with one object per candidate, in the same order. Each object must match this schema:

{
  "candidateName": string,
  "candidatePostcode": string | null,
  "candidateEmail": string | null,
  "candidatePhone": string | null,
  "overallScore": number,
  "recommendation": "strong" | "consider" | "reject",
  "commute": {
    "viable": boolean,
    "estimatedMinutes": number | null,
    "hasDriverLicence": boolean | null,
    "reasoning": string
  },
  "experience": {
    "score": number,
    "yearsOfRelevantWork": number,
    "relevantRoles": string[],
    "reasoning": string
  },
  "tenure": {
    "score": number,
    "avgYearsPerRole": number,
    "rolesInLast5Years": number,
    "reasoning": string
  },
  "requirementsMet": [
    { "requirement": string, "status": "met" | "not_met" | "unclear", "evidence": string }
  ],
  "redFlags": string[],
  "summary": string
}`;

  // Use higher max_tokens for batch
  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 16000,
    temperature: 0,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";

  try {
    const cleaned = text.replace(/^```json?\s*\n?/i, "").replace(/\n?```\s*$/i, "");
    const parsed = JSON.parse(cleaned) as ScoredCandidate[];
    return parsed;
  } catch {
    if (retryCount < 1) {
      return scoreCsvBatch(job, candidates, retryCount + 1);
    }
    throw new Error(`Failed to parse batch response as JSON: ${text.slice(0, 300)}`);
  }
}
