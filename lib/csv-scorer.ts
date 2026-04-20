import { Job, ScoredCandidate } from "./types";
import { CsvCandidate } from "./csv-parser";

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

function scoreCommute(
  candidate: CsvCandidate,
  job: Job
): { score: number; viable: boolean; estimatedMinutes: number | null; hasDriverLicence: boolean; reasoning: string } {
  const travelTime = getQualificationAnswer(candidate, "travel") || getQualificationAnswer(candidate, "long");
  const hasLicence = getQualificationAnswer(candidate, "driving")?.toLowerCase() === "yes";
  const postcode = getQualificationAnswer(candidate, "postcode") || "";
  const minutes = parseMinutes(travelTime);

  let score: number;
  let viable: boolean;

  if (minutes !== null) {
    if (minutes <= 15) { score = 95; viable = true; }
    else if (minutes <= 20) { score = 85; viable = true; }
    else if (minutes <= 30) { score = 70; viable = true; }
    else if (minutes <= 45) { score = 45; viable = false; }
    else { score = 20; viable = false; }
  } else {
    score = 40;
    viable = false;
  }

  // Boost for having licence (important for mobile/evening roles with no buses)
  if (hasLicence) score = Math.min(100, score + 10);
  else score = Math.max(0, score - 10);

  const reasoning = `${candidate.location} (${postcode || "no postcode"}) → ${job.postcode}. Self-reported: ${travelTime || "not stated"}. ${hasLicence ? "Has" : "No"} driving licence.`;

  return { score, viable, estimatedMinutes: minutes, hasDriverLicence: hasLicence, reasoning };
}

function scoreExperience(candidate: CsvCandidate): {
  score: number;
  years: number;
  relevantRoles: string[];
  reasoning: string;
} {
  const yearsStr = getQualificationAnswer(candidate, "cleaning experience");
  const years = yearsStr ? parseInt(yearsStr) || 0 : 0;
  const recentRole = candidate.relevantExperience || "";

  let score = Math.min(100, years * 13); // ~8 years = 100

  const cleaningKeywords = ["clean", "janitor", "housekeep", "hygiene", "operative"];
  const isDirectCleaning = cleaningKeywords.some((k) =>
    recentRole.toLowerCase().includes(k)
  );

  const relevantKeywords = ["care", "hospital", "retail", "warehouse", "kitchen", "porter", "hotel", "laundry"];
  const isRelevant = relevantKeywords.some((k) =>
    recentRole.toLowerCase().includes(k)
  );

  const relevantRoles: string[] = [];
  if (isDirectCleaning) {
    score = Math.min(100, score + 15);
    relevantRoles.push(recentRole);
  } else if (isRelevant) {
    score = Math.min(100, score + 5);
    relevantRoles.push(recentRole);
  } else if (recentRole) {
    score = Math.max(0, score - 5);
  }

  let reasoning = `${years} years commercial cleaning experience claimed.`;
  if (recentRole) {
    reasoning += ` Most recent role: ${recentRole}.`;
    if (isDirectCleaning) reasoning += " Directly relevant.";
    else if (isRelevant) reasoning += " Related field.";
    else reasoning += " Not directly cleaning-related.";
  } else {
    reasoning += " No recent role listed.";
  }

  return { score, years, relevantRoles, reasoning };
}

export function scoreCsvCandidateLocally(
  candidate: CsvCandidate,
  job: Job
): ScoredCandidate {
  const commute = scoreCommute(candidate, job);
  const experience = scoreExperience(candidate);
  const hasLicence = commute.hasDriverLicence;
  const postcode = getQualificationAnswer(candidate, "postcode") || null;

  // Tenure: not available from CSV data
  const tenure = {
    score: 50,
    avgYearsPerRole: 0,
    rolesInLast5Years: 0,
    reasoning: "Full work history not available in CSV export — cannot assess tenure.",
  };

  // Requirements check
  const requirementsMet: ScoredCandidate["requirementsMet"] = [];
  const years = experience.years;

  for (const req of job.requirements) {
    const reqLower = req.toLowerCase();
    if (reqLower.includes("cleaning") || reqLower.includes("experience") || reqLower.includes("1 year")) {
      requirementsMet.push({
        requirement: req,
        status: years >= 1 ? "met" : "not_met",
        evidence: `${years} years cleaning experience claimed`,
      });
    } else if (reqLower.includes("driving") || reqLower.includes("licence")) {
      requirementsMet.push({
        requirement: req,
        status: hasLicence ? "met" : "not_met",
        evidence: hasLicence ? "Has valid driving licence" : "No driving licence",
      });
    } else if (reqLower.includes("right to work")) {
      requirementsMet.push({
        requirement: req,
        status: "unclear",
        evidence: "Not confirmed in application data",
      });
    } else {
      requirementsMet.push({
        requirement: req,
        status: "unclear",
        evidence: "Cannot determine from CSV data",
      });
    }
  }

  // Red flags
  const redFlags: string[] = [];
  if (!commute.viable) redFlags.push("Commute may be too long");
  if (years < 1) redFlags.push("Less than 1 year cleaning experience");
  if (commute.estimatedMinutes && commute.estimatedMinutes > 30 && !hasLicence) {
    redFlags.push("30+ min commute without own transport");
  }
  if (experience.relevantRoles.length === 0 && candidate.relevantExperience) {
    redFlags.push(`Recent role (${candidate.relevantExperience}) not cleaning-related`);
  }

  // Requirements score
  const metCount = requirementsMet.filter((r) => r.status === "met").length;
  const reqScore = requirementsMet.length > 0 ? (metCount / requirementsMet.length) * 100 : 50;

  // Overall weighted score: Commute 30%, Experience 30%, Tenure 25%, Requirements 15%
  const overallScore = Math.round(
    commute.score * 0.3 +
    experience.score * 0.3 +
    tenure.score * 0.25 +
    reqScore * 0.15
  );

  const recommendation: ScoredCandidate["recommendation"] =
    overallScore >= 75 ? "strong" : overallScore >= 50 ? "consider" : "reject";

  const summary = `${years}yr cleaning exp, ${commute.estimatedMinutes || "?"}min commute${hasLicence ? " (drives)" : ""}.${
    candidate.relevantExperience ? " Recent: " + candidate.relevantExperience + "." : ""
  }`;

  return {
    filename: "",
    candidateName: candidate.name,
    candidatePostcode: postcode,
    candidateEmail: candidate.email,
    candidatePhone: candidate.phone,
    overallScore,
    recommendation,
    commute: {
      viable: commute.viable,
      estimatedMinutes: commute.estimatedMinutes,
      hasDriverLicence: commute.hasDriverLicence,
      reasoning: commute.reasoning,
    },
    experience: {
      score: experience.score,
      yearsOfRelevantWork: experience.years,
      relevantRoles: experience.relevantRoles,
      reasoning: experience.reasoning,
    },
    tenure,
    requirementsMet,
    redFlags,
    summary,
  };
}
