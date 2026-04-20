"use client";

interface Props {
  recommendation: "strong" | "consider" | "reject";
}

const styles = {
  strong: "bg-emerald-50 text-emerald-700 border-emerald-200",
  consider: "bg-amber-50 text-amber-700 border-amber-200",
  reject: "bg-red-50 text-red-700 border-red-200",
};

const labels = {
  strong: "Strong",
  consider: "Consider",
  reject: "Reject",
};

export function ScoreBadge({ recommendation }: Props) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold border ${styles[recommendation]}`}
    >
      {labels[recommendation]}
    </span>
  );
}
