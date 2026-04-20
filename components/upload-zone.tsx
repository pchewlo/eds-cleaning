"use client";

import { useCallback, useRef, useState } from "react";

interface Props {
  files: File[];
  setFiles: (files: File[]) => void;
  disabled: boolean;
}

export function UploadZone({ files, setFiles, disabled }: Props) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    (newFiles: FileList | null) => {
      if (!newFiles) return;
      const accepted = Array.from(newFiles).filter((f) =>
        /\.(pdf|docx?|txt|csv)$/i.test(f.name)
      );
      setFiles([...files, ...accepted]);
    },
    [files, setFiles]
  );

  const removeFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (!disabled) handleFiles(e.dataTransfer.files);
        }}
        onClick={() => !disabled && inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${
          disabled
            ? "border-slate-200 bg-slate-100/50 cursor-not-allowed"
            : dragOver
            ? "border-slate-400 bg-slate-100"
            : "border-slate-300 hover:border-slate-400 bg-white"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,.doc,.docx,.txt,.csv"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
          disabled={disabled}
        />
        {disabled ? (
          <p className="text-slate-400 text-sm">Select a job first</p>
        ) : (
          <div>
            <p className="text-slate-600 font-medium text-sm">
              Drop CVs here or click to browse
            </p>
            <p className="text-xs text-slate-400 mt-1">
              PDF, DOCX, TXT, or CSV files
            </p>
          </div>
        )}
      </div>

      {files.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {files.map((file, i) => (
            <span
              key={`${file.name}-${i}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 shadow-sm"
            >
              {file.name}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeFile(i);
                }}
                className="ml-0.5 text-slate-400 hover:text-red-500 transition-colors"
              >
                &times;
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
