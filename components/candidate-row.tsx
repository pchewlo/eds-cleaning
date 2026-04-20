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
        className="cursor-pointer hover:bg-slate-50/80 transition-colors"
      >
        <td className="px-6 py-4 text-center">
          <span className="text-xs font-semibold text-slate-400">{rank}</span>
        </td>
        <td className="px-6 py-4">
          <div className="font-medium text-slate-900 text-sm">{candidate.candidateName}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">{candidate.filename}</div>
        </td>
        <td className="px-6 py-4">
          <div className="flex items-center gap-2.5">
            <span className="font-semibold text-sm text-slate-900 tabular-nums w-7">
              {candidate.overallScore}
            </span>
            <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-slate-600 rounded-full transition-all"
                style={{ width: `${candidate.overallScore}%` }}
              />
            </div>
          </div>
        </td>
        <td className="px-6 py-4">
          <ScoreBadge recommendation={candidate.recommendation} />
        </td>
        <td className="px-6 py-4 text-sm text-slate-600">
          <div className="space-y-0.5">
            {candidate.commute.drivingMinutes != null ? (
              <div className="tabular-nums">
                {candidate.commute.drivingMinutes} min {candidate.commute.hasDriverLicence ? "🚗" : ""}
              </div>
            ) : candidate.commute.estimatedMinutes != null ? (
              <div className="tabular-nums">
                ~{candidate.commute.estimatedMinutes} min {candidate.commute.hasDriverLicence ? "🚗" : ""}
              </div>
            ) : null}
            {candidate.commute.transitMinutes != null && (
              <div className="text-[11px] text-slate-400 tabular-nums">
                {candidate.commute.transitMinutes} min 🚌
              </div>
            )}
          </div>
          {!candidate.commute.viable && (
            <span className="text-red-500 text-[11px] font-medium">(risky)</span>
          )}
        </td>
        <td className="px-6 py-4 text-sm text-slate-600">
          {candidate.candidatePhone ? (
            <a
              href={`tel:${candidate.candidatePhone.replace(/['\s]/g, "")}`}
              onClick={(e) => e.stopPropagation()}
              className="hover:text-slate-900 tabular-nums"
            >
              {candidate.candidatePhone.replace(/^'/, "")}
            </a>
          ) : (
            <span className="text-slate-300">—</span>
          )}
        </td>
        <td className="px-6 py-4">
          <div className="flex flex-wrap gap-1">
            {candidate.redFlags.slice(0, 2).map((flag, i) => (
              <span
                key={i}
                className="px-2 py-0.5 bg-red-50 text-red-700 border border-red-100 rounded text-[11px]"
              >
                {flag}
              </span>
            ))}
            {candidate.redFlags.length > 2 && (
              <span className="px-2 py-0.5 text-slate-400 text-[11px]">
                +{candidate.redFlags.length - 2}
              </span>
            )}
          </div>
        </td>
        <td className="px-4 py-4 text-slate-400">
          <svg
            className={`w-4 h-4 transition-transform ${expanded ? "rotate-180" : ""}`}
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
        <tr className="bg-slate-50/50">
          <td colSpan={8} className="px-6 py-5">
            <div className="max-w-2xl text-sm">
              {/* Contact details — prominent */}
              <div className="flex flex-wrap gap-x-6 gap-y-1 mb-4 text-sm">
                {candidate.candidatePhone && (
                  <a
                    href={`tel:${candidate.candidatePhone.replace(/['\s]/g, "")}`}
                    className="text-slate-900 font-medium hover:underline"
                  >
                    {candidate.candidatePhone.replace(/^'/, "")}
                  </a>
                )}
                {candidate.candidateEmail && (
                  <a
                    href={`mailto:${candidate.candidateEmail}`}
                    className="text-slate-600 hover:underline"
                  >
                    {candidate.candidateEmail}
                  </a>
                )}
                {candidate.candidatePostcode && (
                  <span className="text-slate-500">{candidate.candidatePostcode}</span>
                )}
              </div>

              {/* Summary */}
              <p className="text-slate-700 leading-relaxed mb-5">
                {candidate.summary}
              </p>

              {/* Details as clean list */}
              <dl className="space-y-4">
                <div>
                  <dt className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Commute
                  </dt>
                  <dd className="text-slate-700">{candidate.commute.reasoning}</dd>
                </div>

                <div>
                  <dt className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Experience ({candidate.experience.yearsOfRelevantWork} yrs)
                  </dt>
                  <dd className="text-slate-700">
                    {candidate.experience.reasoning}
                    {candidate.experience.relevantRoles.length > 0 && (
                      <span className="text-slate-500">
                        {" "}— {candidate.experience.relevantRoles.join(", ")}
                      </span>
                    )}
                  </dd>
                </div>

                {candidate.tenure.reasoning && (
                  <div>
                    <dt className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                      Tenure
                    </dt>
                    <dd className="text-slate-700">{candidate.tenure.reasoning}</dd>
                  </div>
                )}

                {candidate.requirementsMet.length > 0 && (
                  <div>
                    <dt className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                      Requirements
                    </dt>
                    <dd>
                      <ul className="space-y-1">
                        {candidate.requirementsMet.map((req, i) => (
                          <li key={i} className="flex items-start gap-2 text-slate-700">
                            <span
                              className={`flex-shrink-0 font-semibold ${
                                req.status === "met"
                                  ? "text-emerald-600"
                                  : req.status === "not_met"
                                  ? "text-red-500"
                                  : "text-slate-400"
                              }`}
                            >
                              {req.status === "met" ? "\u2713" : req.status === "not_met" ? "\u2717" : "?"}
                            </span>
                            <span>
                              {req.requirement} — <span className="text-slate-500">{req.evidence}</span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    </dd>
                  </div>
                )}

                {candidate.redFlags.length > 0 && (
                  <div>
                    <dt className="text-[11px] font-semibold text-red-600 uppercase tracking-wider mb-1">
                      Red flags
                    </dt>
                    <dd>
                      <ul className="space-y-0.5">
                        {candidate.redFlags.map((flag, i) => (
                          <li key={i} className="text-red-700">{flag}</li>
                        ))}
                      </ul>
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
