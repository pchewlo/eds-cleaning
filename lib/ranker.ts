import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

type RankInput = {
  job: { title: string; description: string; criteria?: unknown };
  candidates: Array<{
    id: string;
    cvText: string;
    metadata?: unknown;
  }>;
};

type RankOutput = Array<{
  id: string;
  score: number; // 0–10
  reasoning: string;
  flags: string[];
}>;

const SYSTEM_PROMPT = `You are a recruitment screening assistant for a UK commercial cleaning company. You help managers quickly triage CV applications for specific open cleaning roles.

Score candidates against the specific job provided using these criteria:

1. COMMUTE VIABILITY — Can they realistically get to the job site for the shift hours?
   - Use UK postcode geography for estimates.
   - If shift starts before 7am, assume no buses — the candidate needs a car.

2. RELEVANT EXPERIENCE — What counts as relevant:
   - Strong: commercial cleaning, domestic cleaning, janitorial, housekeeping, domestic assistant, caretaker
   - Strong relevant: care worker, school worker, NHS worker — these backgrounds transfer very well to cleaning
   - Relevant: hospitality, retail, warehouse, kitchen porter, similar hands-on service roles
   - Weaker: office/professional/admin roles with no physical work component
   - IMPORTANT: Long tenure in a single role is a very strong positive signal. Someone who stayed 12 years in one role is far more valuable than someone with 12 separate one-year jobs.

3. JOB TENURE — Value long-term single-role tenure highly.
   - Long single-role tenure (5+ years in one job) = very strong positive.
   - Average under 1.5 years per role = red flag (job hopper).
   - 6–12 month stints repeatedly = red flag.

4. JOB-SPECIFIC REQUIREMENTS — Evaluate against any requirements in the job description.

Score from 0 to 10 (10 = perfect match). Be discriminating — most candidates should score 4-7.

OUTPUT: Return a JSON array of objects, one per candidate, in the same order as provided. Each object must have:
- "id": the candidate ID provided
- "score": number 0-10
- "reasoning": 1-2 sentences explaining the score
- "flags": array of short warning strings (e.g. "no driving licence", "long commute", "job hopper")

Return valid JSON only. No preamble, no markdown fencing.`;

export async function rankCandidates(input: RankInput): Promise<RankOutput> {
  if (input.candidates.length === 0) return [];

  const candidateBlocks = input.candidates
    .map(
      (c, i) =>
        `### Candidate ${i + 1} (ID: ${c.id})\n${c.cvText.slice(0, 4000)}`
    )
    .join("\n---\n");

  const userPrompt = `## Job
Title: ${input.job.title}
Description:
${input.job.description}

---

## Candidates (${input.candidates.length})
${candidateBlocks}

---

Score all ${input.candidates.length} candidates. Return a JSON array.`;

  // Process in batches of 5 to stay within token limits
  const BATCH_SIZE = 5;
  const allResults: RankOutput = [];

  for (let i = 0; i < input.candidates.length; i += BATCH_SIZE) {
    const batch = input.candidates.slice(i, i + BATCH_SIZE);
    const batchBlocks = batch
      .map((c, j) => `### Candidate ${j + 1} (ID: ${c.id})\n${c.cvText.slice(0, 4000)}`)
      .join("\n---\n");

    const batchPrompt = `## Job
Title: ${input.job.title}
Description:
${input.job.description}

---

## Candidates (${batch.length})
${batchBlocks}

---

Score all ${batch.length} candidates. Return a JSON array with "id", "score" (0-10), "reasoning", and "flags" for each.`;

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4000,
      temperature: 0,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: batchPrompt }],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";

    try {
      const cleaned = text
        .replace(/^```json?\s*\n?/i, "")
        .replace(/\n?```\s*$/i, "");
      const parsed = JSON.parse(cleaned) as RankOutput;
      allResults.push(...parsed);
    } catch {
      // If parsing fails, give each candidate a default score
      for (const c of batch) {
        allResults.push({
          id: c.id,
          score: 0,
          reasoning: "Could not score — parsing error.",
          flags: ["scoring error"],
        });
      }
    }
  }

  return allResults;
}
