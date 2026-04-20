"use client";

import { Job } from "@/lib/types";

interface Props {
  jobs: Job[];
  selectedJob: Job | null;
  onSelect: (job: Job) => void;
  loading: boolean;
  error: string | null;
}

function SkeletonCard() {
  return (
    <div className="p-4 rounded-xl border border-slate-200 bg-white h-[120px]">
      <div className="skeleton h-4 w-3/4 mb-3" />
      <div className="skeleton h-3 w-1/2 mb-2" />
      <div className="skeleton h-3 w-2/3 mb-2" />
      <div className="skeleton h-3 w-1/3" />
    </div>
  );
}

export function JobSelector({ jobs, selectedJob, onSelect, loading, error }: Props) {
  if (loading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 min-h-[260px]">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-red-700 bg-red-50 border border-red-200 rounded-xl text-sm">
        {error}
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="p-4 text-slate-500 text-sm">No open jobs found.</div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 min-h-[260px]">
      {jobs.map((job) => {
        const isSelected = selectedJob?.id === job.id;
        return (
          <button
            key={job.id}
            onClick={() => onSelect(job)}
            className={`text-left p-4 rounded-xl border transition-all h-[120px] flex flex-col justify-between ${
              isSelected
                ? "border-slate-900 bg-slate-900 text-white shadow-md ring-1 ring-slate-900"
                : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"
            }`}
          >
            <h3 className={`font-semibold text-sm leading-tight line-clamp-2 ${isSelected ? "text-white" : "text-slate-900"}`}>
              {job.title}
            </h3>
            <div className="space-y-0.5 mt-auto">
              {job.location && (
                <p className={`text-xs ${isSelected ? "text-slate-300" : "text-slate-500"}`}>
                  {job.location}
                </p>
              )}
              <div className={`flex items-center gap-2 text-xs ${isSelected ? "text-slate-300" : "text-slate-500"}`}>
                {job.hourlyRate && <span className="font-medium">{job.hourlyRate}</span>}
                {job.hoursPerWeek > 0 && (
                  <>
                    <span className={`${isSelected ? "text-slate-500" : "text-slate-300"}`}>&middot;</span>
                    <span>{job.hoursPerWeek} hrs/week</span>
                  </>
                )}
              </div>
              {job.shiftPattern && (
                <p className={`text-[11px] ${isSelected ? "text-slate-400" : "text-slate-400"}`}>
                  {job.shiftPattern}
                </p>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
