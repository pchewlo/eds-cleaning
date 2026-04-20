"use client";

import { useEffect, useState } from "react";
import { Job, ScoreResponse } from "@/lib/types";
import { JobSelector } from "@/components/job-selector";
import { UploadZone } from "@/components/upload-zone";
import { ExclusionTextarea } from "@/components/exclusion-textarea";
import { ResultsTable } from "@/components/results-table";

export default function Home() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [jobsError, setJobsError] = useState<string | null>(null);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [excludeList, setExcludeList] = useState("");
  const [scoring, setScoring] = useState(false);
  const [results, setResults] = useState<ScoreResponse | null>(null);
  const [totalCandidates, setTotalCandidates] = useState(0);

  useEffect(() => {
    fetch("/api/jobs")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setJobsError(data.error);
        } else {
          setJobs(data.jobs);
        }
      })
      .catch(() => setJobsError("Could not load jobs. Please refresh."))
      .finally(() => setJobsLoading(false));
  }, []);

  const handleSubmit = async () => {
    if (!selectedJob || files.length === 0) return;

    setScoring(true);
    setResults(null);
    setTotalCandidates(files.length);

    const formData = new FormData();
    formData.append("jobId", selectedJob.id);
    formData.append("excludeList", excludeList);
    files.forEach((f) => formData.append("files", f));

    try {
      const res = await fetch("/api/score", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.error) {
        alert(data.error);
      } else {
        setResults(data);
      }
    } catch {
      alert("An error occurred. Please try again.");
    } finally {
      setScoring(false);
      setTotalCandidates(0);
    }
  };

  return (
    <main className="max-w-5xl mx-auto px-6 py-10">
      {/* Header */}
      <header className="mb-10">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Minster CV Ranker
        </h1>
        <p className="text-slate-500 mt-1 text-[15px]">
          Select a job, upload CVs, and get ranked candidates in seconds.
        </p>
      </header>

      {/* Step 1 */}
      <section className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-900 text-white text-xs font-semibold">
            1
          </span>
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
            Select a job
          </h2>
        </div>
        <JobSelector
          jobs={jobs}
          selectedJob={selectedJob}
          onSelect={setSelectedJob}
          loading={jobsLoading}
          error={jobsError}
        />
      </section>

      {/* Divider */}
      <div className="border-t border-slate-200 my-8" />

      {/* Step 2 */}
      <section className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-900 text-white text-xs font-semibold">
            2
          </span>
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
            Upload CVs
          </h2>
        </div>
        <UploadZone files={files} setFiles={setFiles} disabled={!selectedJob} />
      </section>

      {/* Exclusion */}
      <section className="mb-8">
        <ExclusionTextarea value={excludeList} onChange={setExcludeList} />
      </section>

      {/* Divider */}
      <div className="border-t border-slate-200 my-8" />

      {/* Submit */}
      <section className="mb-10">
        <button
          onClick={handleSubmit}
          disabled={!selectedJob || files.length === 0 || scoring}
          className="px-6 py-2.5 bg-slate-900 text-white text-sm font-medium rounded-lg disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-800 transition-colors shadow-sm"
        >
          {scoring ? "Ranking..." : "Rank candidates"}
        </button>
      </section>

      {/* Results area */}
      <section>
        {scoring && (
          <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="h-5 w-5 rounded-full border-2 border-slate-300 border-t-slate-700 animate-spin" />
              <p className="text-sm font-medium text-slate-600 soft-pulse">
                Ranking {totalCandidates} candidate{totalCandidates !== 1 ? "s" : ""}...
              </p>
            </div>
            <div className="mt-5 space-y-3">
              {Array.from({ length: Math.min(totalCandidates, 5) }).map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <div className="skeleton h-4 w-6" />
                  <div className="skeleton h-4 w-40" />
                  <div className="skeleton h-4 w-16 ml-auto" />
                </div>
              ))}
            </div>
          </div>
        )}

        {results && !scoring && <ResultsTable data={results} />}
      </section>
    </main>
  );
}
