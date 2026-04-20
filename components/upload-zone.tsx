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
        /\.(pdf|docx?|txt)$/i.test(f.name)
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
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
          disabled
            ? "border-gray-200 bg-gray-50 cursor-not-allowed"
            : dragOver
            ? "border-blue-400 bg-blue-50"
            : "border-gray-300 hover:border-gray-400"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,.doc,.docx,.txt"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
          disabled={disabled}
        />
        {disabled ? (
          <p className="text-gray-400">Select a job first</p>
        ) : (
          <div>
            <p className="text-gray-600 font-medium">
              Drop CVs here or click to browse
            </p>
            <p className="text-xs text-gray-400 mt-1">
              PDF, DOCX, or TXT files
            </p>
          </div>
        )}
      </div>

      {files.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {files.map((file, i) => (
            <span
              key={`${file.name}-${i}`}
              className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 rounded-full text-sm"
            >
              {file.name}
              <button
                onClick={() => removeFile(i)}
                className="ml-1 text-gray-400 hover:text-red-500"
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
