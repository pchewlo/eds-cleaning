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
};

// Load config — for now from defaults, later could be from DB
export function getScoringConfig(): ScoringConfig {
  return DEFAULT_CONFIG;
}
