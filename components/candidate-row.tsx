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
          {candidate.commute.estimatedMinutes != null && (
            <span className="tabular-nums">
              {candidate.commute.estimatedMinutes} min
              {candidate.commute.hasDriverLicence ? " \u{1F697}" : ""}
            </span>
          )}
          {!candidate.commute.viable && (
            <span className="text-red-500 text-[11px] ml-1 font-medium">(risky)</span>
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
            <div className="max-w-3xl space-y-5 text-sm">
              {/* Summary */}
              <p className="text-slate-800 leading-relaxed font-medium">
                {candidate.summary}
              </p>

              {/* Detail grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Commute */}
                <div className="bg-white rounded-lg border border-slate-200 p-4">
                  <h4 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    Commute
                  </h4>
                  <p className="text-slate-600 text-sm leading-relaxed">
                    {candidate.commute.reasoning}
                  </p>
                </div>

                {/* Experience */}
                <div className="bg-white rounded-lg border border-slate-200 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                      Experience
                    </h4>
                    <span className="text-[11px] font-semibold text-slate-400 tabular-nums">
                      {candidate.experience.score}/10
                    </span>
                  </div>
                  <p className="text-slate-600 text-sm leading-relaxed">
                    {candidate.experience.reasoning}
                  </p>
                  {candidate.experience.relevantRoles.length > 0 && (
                    <p className="text-[11px] text-slate-400 mt-2">
                      Relevant: {candidate.experience.relevantRoles.join(", ")}
                    </p>
                  )}
                </div>

                {/* Tenure */}
                <div className="bg-white rounded-lg border border-slate-200 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                      Tenure
                    </h4>
                    <span className="text-[11px] font-semibold text-slate-400 tabular-nums">
                      {candidate.tenure.score}/10
                    </span>
                  </div>
                  <p className="text-slate-600 text-sm leading-relaxed">
                    {candidate.tenure.reasoning}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-2">
                    Avg {candidate.tenure.avgYearsPerRole} yrs/role &middot;{" "}
                    {candidate.tenure.rolesInLast5Years} roles in last 5 years
                  </p>
                </div>

                {/* Requirements */}
                {candidate.requirementsMet.length > 0 && (
                  <div className="bg-white rounded-lg border border-slate-200 p-4">
                    <h4 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
                      Requirements
                    </h4>
                    <ul className="space-y-1.5">
                      {candidate.requirementsMet.map((req, i) => (
                        <li key={i} className="flex gap-2 text-sm">
                          <span
                            className={`font-medium flex-shrink-0 ${
                              req.status === "met"
                                ? "text-emerald-600"
                                : req.status === "not_met"
                                ? "text-red-500"
                                : "text-slate-400"
                            }`}
                          >
                            {req.status === "met"
                              ? "\u2713"
                              : req.status === "not_met"
                              ? "\u2717"
                              : "?"}
                          </span>
                          <span className="text-slate-600">
                            <span className="font-medium">{req.requirement}:</span>{" "}
                            {req.evidence}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Red flags */}
              {candidate.redFlags.length > 0 && (
                <div className="bg-red-50 border border-red-100 rounded-lg p-4">
                  <h4 className="text-[11px] font-semibold text-red-700 uppercase tracking-wider mb-2">
                    Red Flags
                  </h4>
                  <ul className="space-y-1">
                    {candidate.redFlags.map((flag, i) => (
                      <li key={i} className="text-sm text-red-700 flex items-start gap-2">
                        <span className="text-red-400 mt-0.5 flex-shrink-0">&bull;</span>
                        {flag}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Contact */}
              {(candidate.candidatePhone || candidate.candidateEmail) && (
                <div className="flex flex-wrap gap-4 text-[11px] text-slate-400 pt-1 border-t border-slate-200">
                  {candidate.candidatePhone && (
                    <span>Phone: {candidate.candidatePhone}</span>
                  )}
                  {candidate.candidateEmail && (
                    <span>Email: {candidate.candidateEmail}</span>
                  )}
                  {candidate.candidatePostcode && (
                    <span>Postcode: {candidate.candidatePostcode}</span>
                  )}
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
