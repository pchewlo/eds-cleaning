import { db } from "@/lib/db";
import { jobs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getJobs } from "@/lib/scraper";

const DEFAULT_RECIPIENT = process.env.ALLOWED_EMAILS?.split(",")[0]?.trim() || "tclittler@gmail.com";

export async function syncJobsFromSite(): Promise<void> {
  const scrapedJobs = await getJobs();

  for (const scraped of scrapedJobs) {
    // Use the Minster job ID as our DB ID
    const [existing] = await db
      .select({ id: jobs.id })
      .from(jobs)
      .where(eq(jobs.id, scraped.id))
      .limit(1);

    if (existing) {
      // Update existing job
      await db
        .update(jobs)
        .set({
          title: scraped.title,
          location: scraped.location,
          description: buildDescription(scraped),
          archivedAt: null, // re-activate if it was archived
        })
        .where(eq(jobs.id, scraped.id));
    } else {
      // Insert new job
      await db.insert(jobs).values({
        id: scraped.id,
        title: scraped.title,
        location: scraped.location,
        description: buildDescription(scraped),
        recipientEmail: DEFAULT_RECIPIENT,
      });
    }
  }

  // Archive jobs that are no longer on the site
  const dbJobs = await db.select({ id: jobs.id }).from(jobs);
  const scrapedIds = new Set(scrapedJobs.map((j) => j.id));

  for (const dbJob of dbJobs) {
    if (!scrapedIds.has(dbJob.id)) {
      await db
        .update(jobs)
        .set({ archivedAt: new Date() })
        .where(eq(jobs.id, dbJob.id));
    }
  }
}

function buildDescription(scraped: {
  title: string;
  location: string;
  postcode: string;
  hourlyRate: string;
  hoursPerWeek: number;
  shiftPattern: string;
  requirements: string[];
  fullDescription: string;
}): string {
  const parts = [];
  parts.push(`Title: ${scraped.title}`);
  parts.push(`Location: ${scraped.location} ${scraped.postcode}`);
  if (scraped.hourlyRate) parts.push(`Rate: ${scraped.hourlyRate}`);
  if (scraped.hoursPerWeek) parts.push(`Hours: ${scraped.hoursPerWeek} per week`);
  if (scraped.shiftPattern) parts.push(`Shift: ${scraped.shiftPattern}`);
  if (scraped.requirements.length > 0) {
    parts.push(`\nRequirements:\n${scraped.requirements.map((r) => `- ${r}`).join("\n")}`);
  }
  if (scraped.fullDescription) {
    parts.push(`\nFull description:\n${scraped.fullDescription}`);
  }
  return parts.join("\n");
}
