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
    "Drive (min)",
    "Transit (min)",
    "Has Licence",
    "Experience (yrs)",
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
    c.commute.drivingMinutes ?? c.commute.estimatedMinutes ?? "",
    c.commute.transitMinutes ?? "",
    c.commute.hasDriverLicence ?? "",
    c.experience.yearsOfRelevantWork,
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
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200">
        <span className="text-[13px] font-medium text-slate-900">
          {data.results.length} candidate{data.results.length !== 1 ? "s" : ""} ranked
        </span>
        <button
          onClick={() => exportCSV(data)}
          className="px-3 py-1 text-[12px] font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors"
        >
          Export CSV
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/50">
              <th className="pl-5 pr-2 py-2.5 text-left text-[11px] font-medium text-slate-500 w-10">
                #
              </th>
              <th className="px-3 py-2.5 text-left text-[11px] font-medium text-slate-500">
                Name
              </th>
              <th className="px-3 py-2.5 text-left text-[11px] font-medium text-slate-500 w-24">
                Score
              </th>
              <th className="px-3 py-2.5 text-left text-[11px] font-medium text-slate-500 w-28">
                Rec
              </th>
              <th className="px-3 py-2.5 text-left text-[11px] font-medium text-slate-500 w-20">
                Commute
              </th>
              <th className="px-3 py-2.5 text-left text-[11px] font-medium text-slate-500 w-36">
                Phone
              </th>
              <th className="px-3 py-2.5 text-left text-[11px] font-medium text-slate-500">
                Flags
              </th>
              <th className="pr-4 py-2.5 w-6" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.results.map((candidate, i) => (
              <CandidateRow
                key={`${candidate.candidateName}-${i}`}
                candidate={candidate}
                rank={i + 1}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Errors */}
      {data.errors.length > 0 && (
        <div className="mx-5 my-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="font-medium text-red-800 text-[12px] mb-1">
            {data.errors.length} file{data.errors.length !== 1 ? "s" : ""} could not be scored
          </p>
          <ul className="text-[11px] text-red-700 space-y-0.5">
            {data.errors.map((e, i) => (
              <li key={i}>
                {e.filename}: {e.error}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
