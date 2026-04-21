import { db } from "@/lib/db";
import { jobs, candidates, uploads } from "@/lib/db/schema";
import { eq, sql, and, gte } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { UploadSection } from "@/components/upload-section";
import { CandidateList } from "@/components/candidate-list";

const DIGEST_THRESHOLD = 7.5;

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  let session;
  try { session = await auth(); } catch { /* auth may fail without adapter */ }

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

  // For each upload that sent a digest, find the candidates that were emailed (score >= threshold)
  const emailedCandidateNames = allCandidates
    .filter((c) => c.rankScore && parseFloat(c.rankScore) >= DIGEST_THRESHOLD)
    .map((c) => c.name || "Unknown");

  const hasDigest = uploadHistory.some((u) => u.digestSentAt !== null);

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

      {/* Candidates */}
      <CandidateList
        jobId={id}
        candidates={allCandidates.map((c) => {
          const score = c.rankScore ? parseFloat(c.rankScore) : null;
          const meetsThreshold = score !== null && score >= DIGEST_THRESHOLD;
          return {
            id: c.id,
            name: c.name,
            email: c.email,
            phone: c.phone,
            score,
            reasoning: c.rankReasoning,
            flags: (c.rankFlags as string[]) || [],
            uploadedAt: c.uploadedAt?.toISOString() || null,
            metadata: c.metadataJson as Record<string, unknown> | null,
            digestSent: hasDigest && meetsThreshold,
          };
        })}
      />

      {/* Upload history — below candidates */}
      {uploadHistory.length > 0 && (
        <div className="mt-10 pt-8 border-t border-slate-200">
          <h2 className="text-[12px] font-medium text-slate-400 uppercase tracking-wide mb-4">
            Upload history
          </h2>
          <div className="space-y-3">
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
                <div key={u.id} className="text-sm">
                  <div className="flex items-center gap-3 text-slate-600">
                    <span className="text-slate-400 tabular-nums text-xs">{date}</span>
                    <span>
                      {u.newCount} new candidate{u.newCount !== 1 ? "s" : ""}
                      {u.duplicateCount ? ` · ${u.duplicateCount} duplicate${u.duplicateCount !== 1 ? "s" : ""} skipped` : ""}
                    </span>
                  </div>
                  {u.digestSentAt && emailedCandidateNames.length > 0 && (
                    <div className="mt-1 ml-[72px] text-[12px] text-emerald-700">
                      ✉️ Emailed {emailedCandidateNames.length} candidate{emailedCandidateNames.length !== 1 ? "s" : ""} for review: {emailedCandidateNames.join(", ")}
                    </div>
                  )}
                  {u.digestSentAt && emailedCandidateNames.length === 0 && (
                    <div className="mt-1 ml-[72px] text-[12px] text-slate-400">
                      No candidates scored above {DIGEST_THRESHOLD} — no email sent
                    </div>
                  )}
                  {u.digestError && (
                    <div className="mt-1 ml-[72px] text-[12px] text-red-500">
                      ✗ Email failed: {u.digestError}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </main>
  );
}
