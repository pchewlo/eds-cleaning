import { db } from "@/lib/db";
import { jobs, candidates } from "@/lib/db/schema";
import { isNull, count, sql, eq } from "drizzle-orm";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SignOutButton } from "@/components/sign-out-button";
export const dynamic = "force-dynamic";

export default async function JobsPage() {
  const session = await auth();
  if (!session) redirect("/login");

  // Debug: check raw count first
  const allJobs = await db.select({ id: jobs.id, archived: jobs.archivedAt }).from(jobs);
  console.log(`[DEBUG] Total jobs in DB: ${allJobs.length}, archived: ${allJobs.filter(j => j.archived !== null).length}`);

  const jobList = await db
    .select({
      id: jobs.id,
      title: jobs.title,
      location: jobs.location,
      recipientEmail: jobs.recipientEmail,
      createdAt: jobs.createdAt,
      candidateCount: count(candidates.id),
    })
    .from(jobs)
    .leftJoin(candidates, eq(candidates.jobId, jobs.id))
    .where(isNull(jobs.archivedAt))
    .groupBy(jobs.id)
    .orderBy(sql`${jobs.createdAt} desc`);

  console.log(`[DEBUG] Jobs after filter: ${jobList.length}`);

  return (
    <main className="w-full max-w-4xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">
            Minster CV Triage
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {jobList.length} active role{jobList.length !== 1 ? "s" : ""} · {session.user?.email}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/jobs/new"
            className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            + Custom job
          </Link>
          <SignOutButton />
        </div>
      </div>

      {jobList.length === 0 ? (
        <div className="text-center py-16 text-slate-500 text-sm">
          <p>No open jobs found on the Minster careers site.</p>
          <p className="mt-1 text-slate-400">Jobs will appear here automatically when posted.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {jobList.map((job) => (
            <Link
              key={job.id}
              href={`/jobs/${job.id}`}
              className="block bg-white rounded-xl border border-slate-200 hover:border-slate-300 hover:shadow-sm p-5 transition-all"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-[15px] font-semibold text-slate-900">
                    {job.title}
                  </h2>
                  {job.location && (
                    <p className="text-sm text-slate-500 mt-0.5">{job.location}</p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {job.candidateCount > 0 && (
                    <span className="text-xs font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                      {job.candidateCount} candidate{job.candidateCount !== 1 ? "s" : ""}
                    </span>
                  )}
                  <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
