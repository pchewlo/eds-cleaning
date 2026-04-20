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
        className="text-sm text-gray-500 hover:text-gray-700 underline"
      >
        {open ? "Hide" : "Show"} exclusion list
      </button>
      {open && (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Paste names or emails to exclude (one per line)"
          className="mt-2 w-full h-24 p-3 border border-gray-300 rounded-lg text-sm resize-y focus:outline-none focus:ring-2 focus:ring-blue-300"
        />
      )}
    </div>
  );
}
