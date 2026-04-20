"use client";

import { useState } from "react";
import { ScoredCandidate } from "@/lib/types";
import { ScoreBadge } from "./score-badge";

interface Props {
  candidate: ScoredCandidate;
  rank: number;
}

export function CandidateRow({ candidate, rank }: Props) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <tr
        onClick={() => setExpanded(!expanded)}
        className="cursor-pointer hover:bg-gray-50 border-b"
      >
        <td className="px-3 py-3 text-center font-medium text-gray-500">
          {rank}
        </td>
        <td className="px-3 py-3">
          <div className="font-medium">{candidate.candidateName}</div>
          <div className="text-xs text-gray-400">{candidate.filename}</div>
        </td>
        <td className="px-3 py-3">
          <div className="flex items-center gap-2">
            <span className="font-semibold">{candidate.overallScore}</span>
            <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full"
                style={{ width: `${candidate.overallScore}%` }}
              />
            </div>
          </div>
        </td>
        <td className="px-3 py-3">
          <ScoreBadge recommendation={candidate.recommendation} />
        </td>
        <td className="px-3 py-3 text-sm">
          {candidate.commute.estimatedMinutes != null && (
            <span>
              {candidate.commute.estimatedMinutes} min
              {candidate.commute.hasDriverLicence ? " 🚗" : ""}
            </span>
          )}
          {!candidate.commute.viable && (
            <span className="text-red-500 text-xs ml-1">(risky)</span>
          )}
        </td>
        <td className="px-3 py-3">
          <div className="flex flex-wrap gap-1">
            {candidate.redFlags.slice(0, 2).map((flag, i) => (
              <span
                key={i}
                className="px-2 py-0.5 bg-red-50 text-red-700 rounded text-xs"
              >
                {flag}
              </span>
            ))}
          </div>
        </td>
        <td className="px-3 py-3 text-sm text-gray-400">
          {expanded ? "▲" : "▼"}
        </td>
      </tr>
      {expanded && (
        <tr className="bg-gray-50">
          <td colSpan={7} className="px-6 py-4">
            <div className="space-y-4 text-sm">
              <p className="font-medium text-gray-800">{candidate.summary}</p>

              <div>
                <h4 className="font-semibold text-gray-700 mb-1">Commute</h4>
                <p className="text-gray-600">{candidate.commute.reasoning}</p>
              </div>

              <div>
                <h4 className="font-semibold text-gray-700 mb-1">
                  Experience (score: {candidate.experience.score})
                </h4>
                <p className="text-gray-600">
                  {candidate.experience.reasoning}
                </p>
                {candidate.experience.relevantRoles.length > 0 && (
                  <p className="text-xs text-gray-500 mt-1">
                    Relevant roles:{" "}
                    {candidate.experience.relevantRoles.join(", ")}
                  </p>
                )}
              </div>

              <div>
                <h4 className="font-semibold text-gray-700 mb-1">
                  Tenure (score: {candidate.tenure.score})
                </h4>
                <p className="text-gray-600">{candidate.tenure.reasoning}</p>
                <p className="text-xs text-gray-500 mt-1">
                  Avg {candidate.tenure.avgYearsPerRole} yrs/role |{" "}
                  {candidate.tenure.rolesInLast5Years} roles in last 5 years
                </p>
              </div>

              {candidate.requirementsMet.length > 0 && (
                <div>
                  <h4 className="font-semibold text-gray-700 mb-1">
                    Requirements
                  </h4>
                  <ul className="space-y-1">
                    {candidate.requirementsMet.map((req, i) => (
                      <li key={i} className="flex gap-2">
                        <span
                          className={
                            req.status === "met"
                              ? "text-green-600"
                              : req.status === "not_met"
                              ? "text-red-600"
                              : "text-gray-400"
                          }
                        >
                          {req.status === "met"
                            ? "✓"
                            : req.status === "not_met"
                            ? "✗"
                            : "?"}
                        </span>
                        <span className="text-gray-600">
                          {req.requirement}: {req.evidence}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {candidate.redFlags.length > 0 && (
                <div>
                  <h4 className="font-semibold text-gray-700 mb-1">
                    Red Flags
                  </h4>
                  <ul className="list-disc list-inside text-red-700">
                    {candidate.redFlags.map((flag, i) => (
                      <li key={i}>{flag}</li>
                    ))}
                  </ul>
                </div>
              )}

              {candidate.candidatePhone && (
                <p className="text-xs text-gray-500">
                  Phone: {candidate.candidatePhone} | Email:{" "}
                  {candidate.candidateEmail || "N/A"} | Postcode:{" "}
                  {candidate.candidatePostcode || "N/A"}
                </p>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
