export type Job = {
  id: string;
  url: string;
  title: string;
  postcode: string;
  location: string;
  hourlyRate: string;
  hoursPerWeek: number;
  shiftPattern: string;
  shiftType: "morning" | "afternoon" | "evening" | "mobile" | "split" | "unknown";
  requirements: string[];
  fullDescription: string;
};

export type ScoredCandidate = {
  filename: string;
  candidateName: string;
  candidatePostcode: string | null;
  candidateEmail: string | null;
  candidatePhone: string | null;
  overallScore: number;
  recommendation: "strong" | "consider" | "reject";
  commute: {
    viable: boolean;
    estimatedMinutes: number | null;
    drivingMinutes: number | null;
    transitMinutes: number | null;
    hasDriverLicence: boolean | null;
    reasoning: string;
  };
  experience: {
    score: number;
    yearsOfRelevantWork: number;
    relevantRoles: string[];
    reasoning: string;
  };
  tenure: {
    score: number;
    avgYearsPerRole: number;
    rolesInLast5Years: number;
    reasoning: string;
  };
  requirementsMet: Array<{
    requirement: string;
    status: "met" | "not_met" | "unclear";
    evidence: string;
  }>;
  redFlags: string[];
  summary: string;
};

export type ScoreResponse = {
  job: Job;
  results: ScoredCandidate[];
  errors: Array<{ filename: string; error: string }>;
};

export type CandidateError = {
  filename: string;
  error: string;
};
