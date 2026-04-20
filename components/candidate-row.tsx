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
        className="cursor-pointer hover:bg-slate-50/60 transition-colors group"
      >
        <td className="pl-5 pr-2 py-3 text-center">
          <span className="text-[13px] text-slate-400 tabular-nums">{rank}</span>
        </td>
        <td className="px-3 py-3">
          <span className="font-medium text-[13px] text-slate-900">{candidate.candidateName}</span>
        </td>
        <td className="px-3 py-3">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-semibold text-slate-900 tabular-nums">
              {candidate.overallScore}
            </span>
            <div className="w-12 h-1 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-slate-500 rounded-full"
                style={{ width: `${candidate.overallScore}%` }}
              />
            </div>
          </div>
        </td>
        <td className="px-3 py-3">
          <ScoreBadge recommendation={candidate.recommendation} />
        </td>
        <td className="px-3 py-3">
          <div className="text-[13px] text-slate-600 tabular-nums">
            {candidate.commute.drivingMinutes != null ? (
              <span>{candidate.commute.drivingMinutes} min</span>
            ) : candidate.commute.estimatedMinutes != null ? (
              <span>~{candidate.commute.estimatedMinutes} min</span>
            ) : (
              <span className="text-slate-400">—</span>
            )}
            {candidate.commute.hasDriverLicence && (
              <span className="ml-1 text-slate-400">🚗</span>
            )}
          </div>
        </td>
        <td className="px-3 py-3">
          {candidate.candidatePhone ? (
            <a
              href={`tel:${candidate.candidatePhone.replace(/['\s]/g, "")}`}
              onClick={(e) => e.stopPropagation()}
              className="text-[13px] text-slate-600 hover:text-slate-900 tabular-nums"
            >
              {candidate.candidatePhone.replace(/^'/, "")}
            </a>
          ) : (
            <span className="text-slate-300">—</span>
          )}
        </td>
        <td className="px-3 py-3">
          <div className="flex flex-wrap gap-1">
            {candidate.redFlags.slice(0, 2).map((flag, i) => (
              <span
                key={i}
                className="px-1.5 py-0.5 bg-red-50 text-red-600 rounded text-[11px] leading-tight"
              >
                {flag}
              </span>
            ))}
            {candidate.redFlags.length > 2 && (
              <span className="text-slate-400 text-[11px]">
                +{candidate.redFlags.length - 2}
              </span>
            )}
          </div>
        </td>
        <td className="pr-4 py-3">
          <svg
            className={`w-3.5 h-3.5 text-slate-400 transition-transform ${expanded ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={8} className="px-5 pb-5 pt-1">
            <div className="bg-slate-50 rounded-lg border border-slate-200/80 px-5 py-4">
              {/* Summary */}
              <p className="text-[13px] text-slate-600 mb-4">
                {candidate.summary}
              </p>

              {/* Sections */}
              <div className="space-y-4">
                {/* Commute */}
                <div>
                  <h4 className="text-[12px] font-semibold text-slate-900 mb-1.5">
                    Commute
                    <span className="font-normal text-slate-500 ml-1.5">
                      {candidate.candidatePostcode || candidate.commute.reasoning.split("(")[1]?.split(")")[0] || ""} → {candidate.candidatePostcode ? "" : ""}{candidate.commute.reasoning.split("→")[1]?.split(".")[0]?.trim() || ""}
                    </span>
                  </h4>
                  <ul className="space-y-0.5 text-[13px] text-slate-600 pl-3">
                    {candidate.commute.estimatedMinutes != null && candidate.commute.drivingMinutes != null && (
                      <li className="flex items-center gap-2">
                        <span className="text-slate-400 text-[10px]">•</span>
                        Self-reported: {candidate.commute.estimatedMinutes} min
                      </li>
                    )}
                    {candidate.commute.drivingMinutes != null && (
                      <li className="flex items-center gap-2">
                        <span className="text-slate-400 text-[10px]">•</span>
                        Google Drive: {candidate.commute.drivingMinutes} min
                      </li>
                    )}
                    {candidate.commute.transitMinutes != null && (
                      <li className="flex items-center gap-2">
                        <span className="text-slate-400 text-[10px]">•</span>
                        Google Public Transport: {candidate.commute.transitMinutes} min
                      </li>
                    )}
                    {candidate.commute.estimatedMinutes != null && candidate.commute.drivingMinutes == null && (
                      <li className="flex items-center gap-2">
                        <span className="text-slate-400 text-[10px]">•</span>
                        Self-reported: {candidate.commute.estimatedMinutes} min
                      </li>
                    )}
                    <li className="flex items-center gap-2">
                      <span className="text-slate-400 text-[10px]">•</span>
                      {candidate.commute.hasDriverLicence ? "Has driving licence" : "No driving licence"}
                    </li>
                  </ul>
                </div>

                {/* Experience */}
                <div>
                  <h4 className="text-[12px] font-semibold text-slate-900 mb-1.5">Experience</h4>
                  <ul className="space-y-0.5 text-[13px] text-slate-600 pl-3">
                    <li className="flex items-center gap-2">
                      <span className="text-slate-400 text-[10px]">•</span>
                      {candidate.experience.yearsOfRelevantWork} years commercial cleaning experience claimed
                    </li>
                    {candidate.experience.relevantRoles.length > 0 && (
                      <li className="flex items-center gap-2">
                        <span className="text-slate-400 text-[10px]">•</span>
                        Most recent role: {candidate.experience.relevantRoles[0]}
                      </li>
                    )}
                    {candidate.experience.relevantRoles.length === 0 && candidate.experience.reasoning.includes("Most recent role:") && (
                      <li className="flex items-center gap-2">
                        <span className="text-slate-400 text-[10px]">•</span>
                        {candidate.experience.reasoning.split("Most recent role:")[1]?.split(".")[0]?.trim()
                          ? `Most recent role: ${candidate.experience.reasoning.split("Most recent role:")[1]?.split(".")[0]?.trim()}`
                          : ""}
                      </li>
                    )}
                  </ul>
                </div>

                {/* Requirements */}
                {candidate.requirementsMet.length > 0 && (
                  <div>
                    <h4 className="text-[12px] font-semibold text-slate-900 mb-1.5">Requirements</h4>
                    <ul className="space-y-0.5 text-[13px] pl-3">
                      {candidate.requirementsMet.map((req, i) => (
                        <li key={i} className="flex items-center gap-2">
                          <span
                            className={`text-[10px] ${
                              req.status === "met"
                                ? "text-emerald-500"
                                : req.status === "not_met"
                                ? "text-red-500"
                                : "text-slate-400"
                            }`}
                          >
                            {req.status === "met" ? "●" : req.status === "not_met" ? "●" : "○"}
                          </span>
                          <span className="text-slate-600">
                            {req.requirement}
                            <span className="text-slate-400 ml-1">— {req.evidence}</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Red flags */}
                {candidate.redFlags.length > 0 && (
                  <div>
                    <h4 className="text-[12px] font-semibold text-red-700 mb-1.5">Red flags</h4>
                    <ul className="space-y-0.5 text-[13px] text-red-600 pl-3">
                      {candidate.redFlags.map((flag, i) => (
                        <li key={i} className="flex items-center gap-2">
                          <span className="text-red-400 text-[10px]">•</span>
                          {flag}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Contact footer */}
              <div className="mt-4 pt-3 border-t border-slate-200/80 flex flex-wrap gap-x-5 gap-y-1 text-[12px]">
                {candidate.candidatePhone && (
                  <a
                    href={`tel:${candidate.candidatePhone.replace(/['\s]/g, "")}`}
                    className="text-slate-700 hover:text-slate-900"
                  >
                    📞 {candidate.candidatePhone.replace(/^'/, "")}
                  </a>
                )}
                {candidate.candidateEmail && (
                  <a
                    href={`mailto:${candidate.candidateEmail}`}
                    className="text-slate-500 hover:text-slate-700"
                  >
                    ✉️ {candidate.candidateEmail}
                  </a>
                )}
                {candidate.candidatePostcode && (
                  <span className="text-slate-500">📍 {candidate.candidatePostcode}</span>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
