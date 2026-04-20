"use client";

interface Props {
  recommendation: "strong" | "consider" | "reject";
}

const colors = {
  strong: "bg-green-100 text-green-800",
  consider: "bg-amber-100 text-amber-800",
  reject: "bg-red-100 text-red-800",
};

export function ScoreBadge({ recommendation }: Props) {
  return (
    <span
      className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${colors[recommendation]}`}
    >
      {recommendation}
    </span>
  );
}
