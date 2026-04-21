import { db } from "@/lib/db";
import { jobs } from "@/lib/db/schema";

export async function GET() {
  try {
    const allJobs = await db.select({ id: jobs.id, title: jobs.title, archived: jobs.archivedAt }).from(jobs);
    return Response.json({
      dbConnected: true,
      totalJobs: allJobs.length,
      jobs: allJobs,
      dbUrl: process.env.DATABASE_URL?.substring(0, 30) + "...",
    });
  } catch (e) {
    return Response.json({
      dbConnected: false,
      error: e instanceof Error ? e.message : "Unknown",
      dbUrl: process.env.DATABASE_URL?.substring(0, 30) + "...",
    });
  }
}
