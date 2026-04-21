"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewJobPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: form.get("title"),
        location: form.get("location"),
        description: form.get("description"),
        recipientEmail: form.get("recipientEmail"),
      }),
    });

    if (res.ok) {
      const { id } = await res.json();
      router.push(`/jobs/${id}`);
    } else {
      alert("Failed to create job");
      setLoading(false);
    }
  };

  return (
    <main className="w-full max-w-2xl mx-auto px-6 py-10">
      <h1 className="text-xl font-semibold text-slate-900 mb-8">New job</h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-[12px] font-medium text-slate-600 mb-1.5">
            Job title
          </label>
          <input
            name="title"
            required
            placeholder="e.g. Cleaner, 15 hours per week, evenings"
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-300 placeholder:text-slate-400"
          />
        </div>

        <div>
          <label className="block text-[12px] font-medium text-slate-600 mb-1.5">
            Location
          </label>
          <input
            name="location"
            placeholder="e.g. Chesterfield, S41 7LF"
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-300 placeholder:text-slate-400"
          />
        </div>

        <div>
          <label className="block text-[12px] font-medium text-slate-600 mb-1.5">
            Job description
          </label>
          <textarea
            name="description"
            required
            rows={8}
            placeholder="Paste the full job description here. This is what candidates are scored against."
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-300 placeholder:text-slate-400 resize-y"
          />
        </div>

        <div>
          <label className="block text-[12px] font-medium text-slate-600 mb-1.5">
            Digest email recipient
          </label>
          <input
            name="recipientEmail"
            type="email"
            required
            defaultValue="tclittler@gmail.com"
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-300 placeholder:text-slate-400"
          />
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={loading}
            className="px-5 py-2.5 bg-slate-900 text-white text-sm font-medium rounded-lg disabled:opacity-40 hover:bg-slate-800 transition-colors"
          >
            {loading ? "Creating..." : "Create job"}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="px-4 py-2.5 text-sm text-slate-500 hover:text-slate-700"
          >
            Cancel
          </button>
        </div>
      </form>
    </main>
  );
}
