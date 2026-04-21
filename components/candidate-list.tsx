"use client";

import { useState } from "react";

interface Candidate {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  score: number | null;
  reasoning: string | null;
  flags: string[];
  uploadedAt: string | null;
}

interface Props {
  candidates: Candidate[];
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

export function CandidateList({ candidates }: Props) {
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

  const scoreBg =
    (c.score ?? 0) >= 7.5
      ? "bg-emerald-100 text-emerald-700"
      : (c.score ?? 0) >= 5
      ? "bg-amber-100 text-amber-700"
      : "bg-red-100 text-red-700";

  return (
    <div>
      <div
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-4 px-4 py-3 cursor-pointer hover:bg-slate-50/60 transition-colors"
      >
        {/* Score */}
        <span
          className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center text-sm font-semibold ${scoreBg}`}
        >
          {c.score !== null ? c.score.toFixed(1) : "—"}
        </span>

        {/* Name + reasoning */}
        <div className="flex-1 min-w-0">
          <div className="font-medium text-[13px] text-slate-900 truncate">
            {c.name || "Unknown"}
          </div>
          {c.reasoning && (
            <p className="text-[12px] text-slate-500 truncate mt-0.5">
              {c.reasoning}
            </p>
          )}
        </div>

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

        {/* Flags */}
        <div className="flex-shrink-0 flex gap-1 hidden md:flex">
          {c.flags.slice(0, 2).map((f, i) => (
            <span
              key={i}
              className="px-1.5 py-0.5 bg-red-50 text-red-600 rounded text-[10px]"
            >
              {f}
            </span>
          ))}
        </div>

        {/* Chevron */}
        <svg
          className={`w-3.5 h-3.5 text-slate-400 flex-shrink-0 transition-transform ${
            expanded ? "rotate-180" : ""
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </div>

      {expanded && (
        <div className="px-4 pb-4 pt-1">
          <div className="bg-slate-50 rounded-lg border border-slate-200/80 p-4 text-sm">
            {/* Contact */}
            <div className="flex flex-wrap gap-x-5 gap-y-1 mb-3 text-[13px]">
              {c.phone && (
                <a
                  href={`tel:${c.phone.replace(/['\s]/g, "")}`}
                  className="text-slate-800 font-medium hover:underline"
                >
                  📞 {c.phone.replace(/^'/, "")}
                </a>
              )}
              {c.email && (
                <a
                  href={`mailto:${c.email}`}
                  className="text-slate-600 hover:underline"
                >
                  ✉️ {c.email}
                </a>
              )}
            </div>

            {/* Reasoning */}
            {c.reasoning && (
              <p className="text-[13px] text-slate-700 mb-3">{c.reasoning}</p>
            )}

            {/* Flags */}
            {c.flags.length > 0 && (
              <div>
                <h4 className="text-[11px] font-semibold text-red-700 uppercase tracking-wider mb-1">
                  Flags
                </h4>
                <ul className="space-y-0.5 text-[13px] text-red-600">
                  {c.flags.map((f, i) => (
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
      )}
    </div>
  );
}
