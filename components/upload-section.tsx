"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  jobId: string;
}

export function UploadSection({ jobId }: Props) {
  const [files, setFiles] = useState<File[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{
    newCount: number;
    duplicateCount: number;
  } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const handleFiles = useCallback(
    (newFiles: FileList | null) => {
      if (!newFiles) return;
      const accepted = Array.from(newFiles).filter((f) =>
        /\.(pdf|docx?|txt|csv)$/i.test(f.name)
      );
      setFiles((prev) => [...prev, ...accepted]);
      setResult(null);
    },
    []
  );

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (files.length === 0) return;
    setUploading(true);
    setResult(null);

    const formData = new FormData();
    files.forEach((f) => formData.append("files", f));

    try {
      const res = await fetch(`/api/jobs/${jobId}/upload`, {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        setResult({ newCount: data.newCount, duplicateCount: data.duplicateCount });
        setFiles([]);
        router.refresh();
      } else {
        const err = await res.json();
        alert(err.error || "Upload failed");
      }
    } catch {
      alert("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="mb-8">
      <h2 className="text-[12px] font-medium text-slate-500 uppercase tracking-wide mb-3">
        Upload CVs
      </h2>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
          dragOver
            ? "border-slate-400 bg-slate-100"
            : "border-slate-200 hover:border-slate-300 bg-white"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,.doc,.docx,.txt,.csv"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <p className="text-sm text-slate-600 font-medium">
          Drop CVs here or click to browse
        </p>
        <p className="text-xs text-slate-400 mt-1">PDF, DOCX, TXT, or CSV</p>
      </div>

      {files.length > 0 && (
        <div className="mt-3">
          <div className="flex flex-wrap gap-1.5 mb-3">
            {files.map((file, i) => (
              <span
                key={`${file.name}-${i}`}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs text-slate-700"
              >
                {file.name}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile(i);
                  }}
                  className="text-slate-400 hover:text-red-500 ml-0.5"
                >
                  &times;
                </button>
              </span>
            ))}
          </div>
          <button
            onClick={handleUpload}
            disabled={uploading}
            className="px-5 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg disabled:opacity-40 hover:bg-slate-800 transition-colors"
          >
            {uploading
              ? `Processing ${files.length} file${files.length !== 1 ? "s" : ""}...`
              : `Upload & rank ${files.length} file${files.length !== 1 ? "s" : ""}`}
          </button>
        </div>
      )}

      {result && (
        <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-800">
          {result.newCount} new candidate{result.newCount !== 1 ? "s" : ""} ranked
          {result.duplicateCount > 0 && (
            <span className="text-emerald-600">
              {" "}· {result.duplicateCount} duplicate{result.duplicateCount !== 1 ? "s" : ""} skipped
            </span>
          )}
        </div>
      )}
    </div>
  );
}
