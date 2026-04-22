// Scoring configuration — editable via /settings page
// This is the single source of truth for all scoring logic

export interface ScoringConfig {
  // Score weights (must sum to 1.0)
  weights: {
    commute: number;
    experience: number;
    tenure: number;
    requirements: number;
  };

  // Commute thresholds (minutes)
  commute: {
    excellent: number;   // score 95
    good: number;        // score 85
    acceptable: number;  // score 70
    marginal: number;    // score 45
    licenceBonus: number; // added if has licence
  };

  // Experience: role categories
  experience: {
    strongRoles: string[];      // direct cleaning roles
    relevantRoles: string[];    // transferable roles
    weakRoles: string[];        // less relevant
    yearsMultiplier: number;    // score = years * this (capped at 100)
    strongRoleBonus: number;
    relevantRoleBonus: number;
  };

  // Tenure
  tenure: {
    longTenureYears: number;    // years to count as "long tenure" bonus
    longTenureBonus: number;
    jobHopperThreshold: number; // avg years below this = penalty
    jobHopperPenalty: number;
  };

  // Digest email
  digest: {
    scoreThreshold: number;     // minimum score (out of 10) to include in email
    recipientEmail: string;
  };

  // Red flags to ignore
  redFlagsToIgnore: string[];

  // AI extraction prompt — controls how CVs are read
  extractionPrompt: string;
}

export const DEFAULT_CONFIG: ScoringConfig = {
  weights: {
    commute: 0.25,
    experience: 0.35,
    tenure: 0.25,
    requirements: 0.15,
  },

  commute: {
    excellent: 15,
    good: 20,
    acceptable: 30,
    marginal: 45,
    licenceBonus: 10,
  },

  experience: {
    strongRoles: [
      "cleaning",
      "cleaner",
      "janitor",
      "housekeeping",
      "housekeeper",
      "domestic assistant",
      "caretaker",
    ],
    relevantRoles: [
      "care worker",
      "care assistant",
      "carer",
      "school",
      "nhs",
      "hospital",
      "hospitality",
      "retail",
      "warehouse",
      "kitchen porter",
      "hotel",
      "laundry",
    ],
    weakRoles: [
      "office",
      "admin",
      "desk",
      "manager",
      "developer",
      "engineer",
    ],
    yearsMultiplier: 12,
    strongRoleBonus: 15,
    relevantRoleBonus: 5,
  },

  tenure: {
    longTenureYears: 5,
    longTenureBonus: 10,
    jobHopperThreshold: 1.5,
    jobHopperPenalty: 15,
  },

  digest: {
    scoreThreshold: 7.5,
    recipientEmail: "tclittler@gmail.com",
  },

  redFlagsToIgnore: [
    "long tenure",
    "only one role",
    "single role",
    "lack of variety",
    "limited roles",
  ],

  extractionPrompt: `You extract structured work history from CVs. Return JSON only, no markdown fencing.

For each candidate extract:
- id: the candidate ID string
- name: full name
- roles: array of ALL jobs listed, each with {title, employer, startYear, endYear, isCleaning: boolean, isRelevant: boolean}
  - isCleaning = true for: cleaning, janitorial, housekeeping, domestic assistant, caretaker roles
  - isRelevant = true for: care worker, school worker, NHS, hospitality, retail, warehouse, kitchen porter AND all cleaning roles
- hasDriverLicence: boolean | null (if mentioned in CV)
- postcode: string | null (if mentioned)
- redFlags: string[] — ONLY flag genuinely concerning issues:
  - Unexplained gaps of 2+ years
  - Overlapping employment dates
  - Claims that contradict other parts of the CV
  - DO NOT flag long tenure in one role — that is a POSITIVE, not a red flag
  - DO NOT flag having only one or two roles — stability is good
  - DO NOT flag lack of variety — we want people who stay put

Be thorough — list EVERY role from the CV, not just relevant ones. Include employer name and years.`,
};

// Load config from DB, falling back to defaults
export async function getScoringConfig(): Promise<ScoringConfig> {
  try {
    const postgres = (await import("postgres")).default;
    const sql = postgres(process.env.DATABASE_URL!);
    const [row] = await sql`SELECT config FROM scoring_config WHERE id = 1`;
    await sql.end();
    if (row?.config) {
      // Merge with defaults so new fields always have values
      return { ...DEFAULT_CONFIG, ...row.config };
    }
  } catch {
    // Table doesn't exist or DB not available
  }
  return DEFAULT_CONFIG;
}
