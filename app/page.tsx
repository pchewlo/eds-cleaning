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
  const [progress, setProgress] = useState("");
  const [results, setResults] = useState<ScoreResponse | null>(null);

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
    setProgress(
      `Scoring ${files.length} candidate${files.length > 1 ? "s" : ""}...`
    );

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
        setProgress("");
        alert(data.error);
      } else {
        setResults(data);
        setProgress("");
      }
    } catch {
      setProgress("");
      alert("An error occurred. Please try again.");
    } finally {
      setScoring(false);
    }
  };

  return (
    <main className="max-w-5xl mx-auto px-4 py-8">
      <header className="mb-8">
        <h1 className="text-2xl font-bold">Minster CV Ranker</h1>
        <p className="text-gray-600 mt-1">
          Select a job, upload CVs, and get ranked candidates in seconds.
        </p>
      </header>

      <section className="mb-6">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
          1. Select a job
        </h2>
        <JobSelector
          jobs={jobs}
          selectedJob={selectedJob}
          onSelect={setSelectedJob}
          loading={jobsLoading}
          error={jobsError}
        />
      </section>

      <section className="mb-6">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
          2. Upload CVs
        </h2>
        <UploadZone files={files} setFiles={setFiles} disabled={!selectedJob} />
      </section>

      <section className="mb-6">
        <ExclusionTextarea value={excludeList} onChange={setExcludeList} />
      </section>

      <section className="mb-8">
        <button
          onClick={handleSubmit}
          disabled={!selectedJob || files.length === 0 || scoring}
          className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors"
        >
          {scoring ? "Scoring..." : "Rank candidates"}
        </button>
        {progress && (
          <p className="mt-2 text-sm text-gray-600 animate-pulse">{progress}</p>
        )}
      </section>

      {results && (
        <section>
          <ResultsTable data={results} />
        </section>
      )}
    </main>
  );
}
