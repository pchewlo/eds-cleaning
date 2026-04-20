"use client";

import { ScoreResponse } from "@/lib/types";
import { CandidateRow } from "./candidate-row";

interface Props {
  data: ScoreResponse;
}

function exportCSV(data: ScoreResponse) {
  const headers = [
    "Rank",
    "Name",
    "Score",
    "Recommendation",
    "Commute (min)",
    "Has Licence",
    "Experience Score",
    "Tenure Score",
    "Red Flags",
    "Summary",
    "Phone",
    "Email",
    "Postcode",
  ];

  const rows = data.results.map((c, i) => [
    i + 1,
    c.candidateName,
    c.overallScore,
    c.recommendation,
    c.commute.estimatedMinutes ?? "",
    c.commute.hasDriverLicence ?? "",
    c.experience.score,
    c.tenure.score,
    c.redFlags.join("; "),
    c.summary,
    c.candidatePhone ?? "",
    c.candidateEmail ?? "",
    c.candidatePostcode ?? "",
  ]);

  const csv = [headers, ...rows]
    .map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
    )
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `cv-rankings-${data.job.id}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function ResultsTable({ data }: Props) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* Header bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Results
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {data.results.length} candidate{data.results.length !== 1 ? "s" : ""} ranked
          </p>
        </div>
        <button
          onClick={() => exportCSV(data)}
          className="px-3.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 rounded-lg transition-colors shadow-sm"
        >
          Export CSV
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="px-6 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider w-12">
                #
              </th>
              <th className="px-6 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Candidate
              </th>
              <th className="px-6 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider w-32">
                Score
              </th>
              <th className="px-6 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider w-28">
                Recommendation
              </th>
              <th className="px-6 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider w-24">
                Commute
              </th>
              <th className="px-6 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider w-36">
                Phone
              </th>
              <th className="px-6 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Flags
              </th>
              <th className="px-4 py-3 w-8" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.results.map((candidate, i) => (
              <CandidateRow
                key={candidate.filename}
                candidate={candidate}
                rank={i + 1}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Errors */}
      {data.errors.length > 0 && (
        <div className="mx-6 my-4 p-4 bg-red-50 border border-red-200 rounded-xl">
          <h3 className="font-medium text-red-800 text-sm mb-2">
            Errors ({data.errors.length} file{data.errors.length !== 1 ? "s" : ""} could not be scored)
          </h3>
          <ul className="text-xs text-red-700 space-y-1">
            {data.errors.map((e, i) => (
              <li key={i}>
                <span className="font-medium">{e.filename}:</span> {e.error}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
