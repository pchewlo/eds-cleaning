"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  jobId: string;
}

export function UploadSection({ jobId }: Props) {
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [cvFiles, setCvFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState("");
  const [result, setResult] = useState<{
    newCount: number;
    duplicateCount: number;
  } | null>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const cvInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const handleCsvFile = useCallback((files: FileList | null) => {
    if (!files) return;
    const csv = Array.from(files).find((f) => f.name.toLowerCase().endsWith(".csv"));
    if (csv) {
      setCsvFile(csv);
      setResult(null);
    }
  }, []);

  const handleCvFiles = useCallback((files: FileList | null) => {
    if (!files) return;
    const accepted = Array.from(files).filter((f) =>
      /\.(pdf|docx?|txt)$/i.test(f.name)
    );
    setCvFiles((prev) => [...prev, ...accepted]);
    setResult(null);
  }, []);

  const removeCvFile = (index: number) => {
    setCvFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const canRank = csvFile !== null || cvFiles.length > 0;

  const handleRank = async () => {
    if (!canRank) return;
    setUploading(true);
    setResult(null);
    setProgress("Uploading files...");

    const formData = new FormData();
    if (csvFile) formData.append("csv", csvFile);
    cvFiles.forEach((f) => formData.append("cvs", f));

    try {
      const res = await fetch(`/api/jobs/${jobId}/upload`, {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        setResult({ newCount: data.newCount, duplicateCount: data.duplicateCount });
        setCsvFile(null);
        setCvFiles([]);
        setProgress("");
        router.refresh();
      } else {
        const err = await res.json();
        alert(err.error || "Upload failed");
        setProgress("");
      }
    } catch {
      alert("Upload failed. Please try again.");
      setProgress("");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="mb-8 space-y-4">
      {/* CSV metadata upload */}
      <div>
        <h3 className="text-[12px] font-medium text-slate-500 uppercase tracking-wide mb-2">
          1. Indeed candidate export (CSV)
        </h3>
        <div
          onClick={() => csvInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors ${
            csvFile
              ? "border-emerald-300 bg-emerald-50"
              : "border-slate-200 hover:border-slate-300 bg-white"
          }`}
        >
          <input
            ref={csvInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => handleCsvFile(e.target.files)}
          />
          {csvFile ? (
            <div className="flex items-center justify-center gap-2 text-sm text-emerald-700">
              <span>✓ {csvFile.name}</span>
              <button
                onClick={(e) => { e.stopPropagation(); setCsvFile(null); }}
                className="text-emerald-500 hover:text-red-500"
              >
                &times;
              </button>
            </div>
          ) : (
            <div>
              <p className="text-sm text-slate-600">Drop Indeed CSV here or click to browse</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Contains candidate metadata: name, phone, postcode, screening answers</p>
            </div>
          )}
        </div>
      </div>

      {/* CV files upload */}
      <div>
        <h3 className="text-[12px] font-medium text-slate-500 uppercase tracking-wide mb-2">
          2. CV files (PDF/DOCX)
        </h3>
        <div
          onDragOver={(e) => { e.preventDefault(); }}
          onDrop={(e) => { e.preventDefault(); handleCvFiles(e.dataTransfer.files); }}
          onClick={() => cvInputRef.current?.click()}
          className="border-2 border-dashed rounded-xl p-4 text-center cursor-pointer border-slate-200 hover:border-slate-300 bg-white transition-colors"
        >
          <input
            ref={cvInputRef}
            type="file"
            multiple
            accept=".pdf,.doc,.docx,.txt"
            className="hidden"
            onChange={(e) => handleCvFiles(e.target.files)}
          />
          <p className="text-sm text-slate-600">Drop CVs here or click to browse</p>
          <p className="text-[11px] text-slate-400 mt-0.5">PDF or DOCX files — used to verify experience and tenure</p>
        </div>

        {cvFiles.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {cvFiles.map((file, i) => (
              <span
                key={`${file.name}-${i}`}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-[11px] text-slate-700"
              >
                {file.name}
                <button
                  onClick={() => removeCvFile(i)}
                  className="text-slate-400 hover:text-red-500 ml-0.5"
                >
                  &times;
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Rank button */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleRank}
          disabled={!canRank || uploading}
          className="px-5 py-2.5 bg-slate-900 text-white text-sm font-medium rounded-lg disabled:opacity-30 hover:bg-slate-800 transition-colors"
        >
          {uploading ? progress || "Processing..." : `Rank candidates`}
        </button>
        {!csvFile && cvFiles.length === 0 && (
          <span className="text-[11px] text-slate-400">Upload a CSV and/or CVs to get started</span>
        )}
        {csvFile && cvFiles.length === 0 && (
          <span className="text-[11px] text-amber-600">CSV only — add CVs for more accurate experience scoring</span>
        )}
        {!csvFile && cvFiles.length > 0 && (
          <span className="text-[11px] text-amber-600">CVs only — add CSV for commute data and contact details</span>
        )}
        {csvFile && cvFiles.length > 0 && (
          <span className="text-[11px] text-emerald-600">✓ CSV + {cvFiles.length} CVs ready — best accuracy</span>
        )}
      </div>

      {result && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-800">
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
