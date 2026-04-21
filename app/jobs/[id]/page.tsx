import { db } from "@/lib/db";
import { jobs, candidates, uploads } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { UploadSection } from "@/components/upload-section";
import { CandidateList } from "@/components/candidate-list";

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const { id } = await params;

  const [job] = await db.select().from(jobs).where(eq(jobs.id, id)).limit(1);
  if (!job) notFound();

  const allCandidates = await db
    .select()
    .from(candidates)
    .where(eq(candidates.jobId, id))
    .orderBy(sql`${candidates.rankScore}::numeric desc nulls last`);

  const uploadHistory = await db
    .select()
    .from(uploads)
    .where(eq(uploads.jobId, id))
    .orderBy(sql`${uploads.uploadedAt} desc`);

  return (
    <main className="w-full max-w-5xl mx-auto px-6 py-10">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <Link
            href="/jobs"
            className="text-sm text-slate-500 hover:text-slate-700 mb-2 inline-block"
          >
            ← All jobs
          </Link>
          <h1 className="text-xl font-semibold text-slate-900">{job.title}</h1>
          {job.location && (
            <p className="text-sm text-slate-500 mt-0.5">{job.location}</p>
          )}
        </div>
        <Link
          href={`/jobs/${id}/edit`}
          className="text-xs text-slate-500 hover:text-slate-700 px-3 py-1.5 border border-slate-200 rounded-lg"
        >
          Edit
        </Link>
      </div>

      {/* Upload section */}
      <UploadSection jobId={id} />

      {/* Upload history */}
      {uploadHistory.length > 0 && (
        <div className="mb-8">
          <h2 className="text-[12px] font-medium text-slate-500 uppercase tracking-wide mb-3">
            Upload history
          </h2>
          <div className="space-y-1.5">
            {uploadHistory.map((u) => {
              const date = u.uploadedAt
                ? new Date(u.uploadedAt).toLocaleDateString("en-GB", {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "Unknown";
              return (
                <div
                  key={u.id}
                  className="flex items-center gap-3 text-sm text-slate-600"
                >
                  <span className="text-slate-400 tabular-nums text-xs">{date}</span>
                  <span>
                    {u.newCount} new
                    {u.duplicateCount ? `, ${u.duplicateCount} duplicates skipped` : ""}
                  </span>
                  {u.digestSentAt && (
                    <span className="text-emerald-600 text-xs">✓ Email sent</span>
                  )}
                  {u.digestError && (
                    <span className="text-red-500 text-xs">✗ Email failed</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Candidates */}
      <CandidateList
        jobId={id}
        candidates={allCandidates.map((c) => ({
          id: c.id,
          name: c.name,
          email: c.email,
          phone: c.phone,
          score: c.rankScore ? parseFloat(c.rankScore) : null,
          reasoning: c.rankReasoning,
          flags: (c.rankFlags as string[]) || [],
          uploadedAt: c.uploadedAt?.toISOString() || null,
          metadata: c.metadataJson as Record<string, unknown> | null,
        }))}
      />
    </main>
  );
}
