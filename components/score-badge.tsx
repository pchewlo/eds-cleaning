"use client";

interface Props {
  recommendation: "strong" | "consider" | "reject";
}

const styles = {
  strong: "bg-emerald-100/80 text-emerald-700",
  consider: "bg-amber-100/80 text-amber-700",
  reject: "bg-red-100/80 text-red-700",
};

const labels = {
  strong: "Strong",
  consider: "Consider",
  reject: "Reject",
};

export function ScoreBadge({ recommendation }: Props) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${styles[recommendation]}`}
    >
      {labels[recommendation]}
    </span>
  );
}
