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
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">
          Results — {data.results.length} candidates ranked
        </h2>
        <button
          onClick={() => exportCSV(data)}
          className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg"
        >
          Export CSV
        </button>
      </div>

      <div className="overflow-x-auto border rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-3 py-2 text-left">#</th>
              <th className="px-3 py-2 text-left">Name</th>
              <th className="px-3 py-2 text-left">Score</th>
              <th className="px-3 py-2 text-left">Rec</th>
              <th className="px-3 py-2 text-left">Commute</th>
              <th className="px-3 py-2 text-left">Flags</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
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

      {data.errors.length > 0 && (
        <div className="mt-4 p-3 bg-red-50 rounded-lg">
          <h3 className="font-medium text-red-800 text-sm mb-2">
            Errors ({data.errors.length} files could not be scored)
          </h3>
          <ul className="text-xs text-red-700 space-y-1">
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
