"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface CommuteData {
  viable: boolean;
  estimatedMinutes: number | null;
  drivingMinutes: number | null;
  transitMinutes: number | null;
  hasDriverLicence: boolean | null;
  reasoning: string;
}

interface ExperienceData {
  score: number;
  yearsOfRelevantWork?: number;
  yearsFromCv?: number;
  yearsFromIndeed?: number;
  relevantRoles: string[];
  reasoning: string;
}

interface RequirementData {
  requirement: string;
  status: "met" | "not_met" | "unclear";
  evidence: string;
}

interface Candidate {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  score: number | null;
  reasoning: string | null;
  flags: string[];
  uploadedAt: string | null;
  metadata: Record<string, unknown> | null;
  digestSent: boolean;
  hasCv: boolean;
}

interface Props {
  candidates: Candidate[];
  jobId: string;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function groupByDate(candidates: Candidate[]): Map<string, Candidate[]> {
  const groups = new Map<string, Candidate[]>();
  for (const c of candidates) {
    const key = c.uploadedAt ? formatDate(c.uploadedAt) : "Unknown";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(c);
  }
  return groups;
}

export function CandidateList({ candidates, jobId }: Props) {
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();

  const handleDeleteAll = async () => {
    setDeleting(true);
    await fetch(`/api/jobs/${jobId}/candidates`, { method: "DELETE" });
    window.location.reload();
  };

  if (candidates.length === 0) {
    return (
      <div className="text-center py-12 text-sm text-slate-400">
        No candidates yet. Upload CVs above to get started.
      </div>
    );
  }

  const groups = groupByDate(candidates);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[12px] font-medium text-slate-500 uppercase tracking-wide">
          All candidates ({candidates.length})
        </h2>
        <button
          onClick={handleDeleteAll}
          disabled={deleting}
          className="px-3 py-1.5 text-xs text-red-600 hover:text-white hover:bg-red-500 border border-red-200 rounded-lg transition-colors"
        >
          {deleting ? "Deleting..." : "Clear all candidates"}
        </button>
      </div>

      {Array.from(groups.entries()).map(([date, group]) => (
        <div key={date} className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
              {date}
            </span>
            <span className="text-xs text-slate-400">
              {group.length} candidate{group.length !== 1 ? "s" : ""}
            </span>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
            {group.map((c) => (
              <CandidateRow key={c.id} candidate={c} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function CandidateRow({ candidate: c }: { candidate: Candidate }) {
  const [expanded, setExpanded] = useState(false);

  const source = c.metadata?.source as string | undefined;
  const isUnverified = c.score !== null && c.score < 0;
  const isIncomplete = source === "csv_only" || source === "pdf_only";
  const missingLabel =
    source === "csv_only" ? "No CV attached"
    : source === "pdf_only" ? "No metadata"
    : null;
  const showNA = isUnverified || isIncomplete;
  const score100 = showNA ? 0 : (c.score ?? 0) * 10;
  const scoreBg = showNA
    ? "bg-slate-100 text-slate-400"
    : score100 >= 75
    ? "bg-emerald-100 text-emerald-700"
    : score100 >= 50
    ? "bg-amber-100 text-amber-700"
    : "bg-red-100 text-red-700";

  const commute = c.metadata?.commute as CommuteData | undefined;
  const experience = c.metadata?.experience as ExperienceData | undefined;
  const requirements = c.metadata?.requirementsMet as RequirementData[] | undefined;
  const redFlags = c.metadata?.redFlags as string[] | undefined;
  const hasLicence = commute?.hasDriverLicence;

  // Show the relevant commute time in the table row
  const commuteDisplay = (() => {
    if (hasLicence && commute?.drivingMinutes != null) return `${commute.drivingMinutes} min 🚗`;
    if (!hasLicence && commute?.transitMinutes != null) return `${commute.transitMinutes} min 🚌`;
    if (commute?.estimatedMinutes != null) return `~${commute.estimatedMinutes} min`;
    return null;
  })();

  return (
    <div>
      <div
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-4 px-4 py-3 cursor-pointer hover:bg-slate-50/60 transition-colors"
      >
        {/* Score */}
        <span className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center text-sm font-semibold ${scoreBg}`}>
          {showNA ? "N/A" : c.score !== null ? c.score.toFixed(1) : "—"}
        </span>

        {/* Name + status label */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-[13px] text-slate-900 truncate">
              {c.name || "Unknown"}
            </span>
            {missingLabel && (
              <span className={`flex-shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                source === "csv_only" ? "bg-slate-100 text-slate-500" : "bg-amber-50 text-amber-600"
              }`}>
                {missingLabel}
              </span>
            )}
            {c.digestSent && (
              <span className="flex-shrink-0 px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded text-[10px] font-medium">
                ✉️ emailed
              </span>
            )}
          </div>
        </div>

        {/* Commute */}
        {commuteDisplay && (
          <span className="flex-shrink-0 text-[12px] text-slate-500 tabular-nums hidden sm:block">
            {commuteDisplay}
          </span>
        )}

        {/* Phone */}
        {c.phone && (
          <a
            href={`tel:${c.phone.replace(/['\s]/g, "")}`}
            onClick={(e) => e.stopPropagation()}
            className="flex-shrink-0 text-[13px] text-slate-600 hover:text-slate-900 tabular-nums hidden sm:block"
          >
            {c.phone.replace(/^'/, "")}
          </a>
        )}

        <svg
          className={`w-3.5 h-3.5 text-slate-400 flex-shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {expanded && (
        <div className="px-4 pb-4 pt-1">
          <div className="bg-slate-50 rounded-lg border border-slate-200/80 px-5 py-4 text-sm">
            {/* Contact */}
            <div className="flex flex-wrap gap-x-5 gap-y-1 mb-4 text-[13px]">
              {c.phone && (
                <a href={`tel:${c.phone.replace(/['\s]/g, "")}`} className="text-slate-800 font-medium hover:underline">
                  📞 {c.phone.replace(/^'/, "")}
                </a>
              )}
              {c.email && (
                <a href={`mailto:${c.email}`} className="text-slate-600 hover:underline">
                  ✉️ {c.email}
                </a>
              )}
              {c.metadata?.postcode != null && (
                <span className="text-slate-500">📍 {`${c.metadata.postcode}`}</span>
              )}
              {c.hasCv && (
                <a
                  href={`/api/candidates/${c.id}/cv`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-blue-600 hover:text-blue-800 font-medium"
                >
                  📄 View CV
                </a>
              )}
            </div>

            {/* Summary */}
            {c.reasoning && <p className="text-[13px] text-slate-600 mb-4">{c.reasoning}</p>}

            <div className="space-y-4">
              {/* Commute */}
              {commute && (
                <div>
                  <h4 className="text-[12px] font-semibold text-slate-900 mb-1.5">Commute</h4>
                  <ul className="space-y-0.5 text-[13px] text-slate-600 pl-3">
                    {commute.estimatedMinutes != null && (
                      <li className="flex items-center gap-2">
                        <span className="text-slate-400 text-[10px]">•</span>
                        Self-reported: {commute.estimatedMinutes} min
                      </li>
                    )}
                    {commute.drivingMinutes != null && (
                      <li className="flex items-center gap-2">
                        <span className="text-slate-400 text-[10px]">•</span>
                        Drive: {commute.drivingMinutes} min
                      </li>
                    )}
                    {commute.transitMinutes != null && (
                      <li className="flex items-center gap-2">
                        <span className="text-slate-400 text-[10px]">•</span>
                        Public transport: {commute.transitMinutes} min
                      </li>
                    )}
                    <li className="flex items-center gap-2">
                      <span className="text-slate-400 text-[10px]">•</span>
                      {commute.hasDriverLicence ? "Has driving licence" : "No driving licence"}
                    </li>
                  </ul>
                </div>
              )}

              {/* Experience */}
              {experience && (
                <div>
                  <h4 className="text-[12px] font-semibold text-slate-900 mb-1.5">Experience</h4>
                  <ul className="space-y-0.5 text-[13px] text-slate-600 pl-3">
                    {(experience.yearsFromCv != null && experience.yearsFromCv > 0) && (
                      <li className="flex items-center gap-2">
                        <span className="text-slate-400 text-[10px]">•</span>
                        {experience.yearsFromCv} years relevant experience (from CV)
                      </li>
                    )}
                    {(experience.yearsFromIndeed != null && experience.yearsFromIndeed > 0) && (
                      <li className="flex items-center gap-2">
                        <span className="text-slate-400 text-[10px]">•</span>
                        {experience.yearsFromIndeed} years claimed on Indeed
                        {experience.yearsFromCv != null && experience.yearsFromCv > 0 && experience.yearsFromIndeed !== experience.yearsFromCv
                          ? <span className="text-amber-600 ml-1">(differs from CV)</span>
                          : null}
                      </li>
                    )}
                    {(experience.yearsOfRelevantWork != null && experience.yearsOfRelevantWork > 0 && !experience.yearsFromCv && !experience.yearsFromIndeed) && (
                      <li className="flex items-center gap-2">
                        <span className="text-slate-400 text-[10px]">•</span>
                        {experience.yearsOfRelevantWork} years relevant experience
                      </li>
                    )}
                    {experience.relevantRoles.length > 0 && experience.relevantRoles.map((role, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-slate-400 text-[10px] mt-1">•</span>
                        <span>{typeof role === 'string' ? role : JSON.stringify(role)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Requirements */}
              {requirements && requirements.length > 0 && (
                <div>
                  <h4 className="text-[12px] font-semibold text-slate-900 mb-1.5">Requirements</h4>
                  <ul className="space-y-0.5 text-[13px] pl-3">
                    {requirements.map((req, i) => (
                      <li key={i} className="flex items-center gap-2 text-slate-600">
                        <span className={`text-[10px] ${
                          req.status === "met" ? "text-emerald-500" : req.status === "not_met" ? "text-red-500" : "text-slate-400"
                        }`}>
                          {req.status === "met" ? "●" : req.status === "not_met" ? "●" : "○"}
                        </span>
                        {req.requirement} — <span className="text-slate-400">{req.evidence}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Red flags */}
              {redFlags && redFlags.length > 0 && (
                <div>
                  <h4 className="text-[12px] font-semibold text-red-700 mb-1.5">Red flags</h4>
                  <ul className="space-y-0.5 text-[13px] text-red-600 pl-3">
                    {redFlags.map((f, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <span className="text-red-400 text-[10px]">•</span>
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
