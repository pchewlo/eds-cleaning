"use client";

import { useState } from "react";

interface Props {
  value: string;
  onChange: (val: string) => void;
}

export function ExclusionTextarea({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="text-xs font-medium text-slate-500 hover:text-slate-700 transition-colors flex items-center gap-1.5"
      >
        <span className="text-[10px]">{open ? "\u25BC" : "\u25B6"}</span>
        {open ? "Hide" : "Show"} exclusion list
      </button>
      {open && (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Paste names or emails to exclude (one per line)"
          className="mt-3 w-full h-24 p-3 border border-slate-200 rounded-xl text-sm text-slate-700 placeholder:text-slate-400 resize-y bg-white focus:outline-none focus:ring-2 focus:ring-slate-300 focus:border-slate-300 transition-shadow"
        />
      )}
    </div>
  );
}
