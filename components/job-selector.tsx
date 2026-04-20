"use client";

import { Job } from "@/lib/types";

interface Props {
  jobs: Job[];
  selectedJob: Job | null;
  onSelect: (job: Job) => void;
  loading: boolean;
  error: string | null;
}

export function JobSelector({ jobs, selectedJob, onSelect, loading, error }: Props) {
  if (loading) {
    return (
      <div className="p-4 text-gray-500 animate-pulse">Loading jobs...</div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-red-600 bg-red-50 rounded-lg">
        {error}
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="p-4 text-gray-500">No open jobs found.</div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {jobs.map((job) => (
        <button
          key={job.id}
          onClick={() => onSelect(job)}
          className={`text-left p-4 rounded-lg border-2 transition-all hover:shadow-md ${
            selectedJob?.id === job.id
              ? "border-blue-500 bg-blue-50"
              : "border-gray-200 hover:border-gray-300"
          }`}
        >
          <h3 className="font-semibold text-sm leading-tight mb-2">
            {job.title}
          </h3>
          <div className="space-y-1 text-xs text-gray-600">
            <p>{job.hourlyRate}</p>
            <p>{job.hoursPerWeek > 0 ? `${job.hoursPerWeek} hrs/week` : ""}</p>
            <p className="text-gray-500">{job.shiftPattern}</p>
          </div>
        </button>
      ))}
    </div>
  );
}
