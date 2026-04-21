import { db } from "@/lib/db";
import { jobs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getJobs } from "@/lib/scraper";

const DEFAULT_RECIPIENT = process.env.ALLOWED_EMAILS?.split(",")[0]?.trim() || "tclittler@gmail.com";

export async function syncJobsFromSite(): Promise<void> {
  const scrapedJobs = await getJobs();

  for (const scraped of scrapedJobs) {
    // Clean up title — strip HTML junk, newlines, extra whitespace
    const cleanTitle = scraped.title
      .replace(/\s+/g, " ")
      .replace(/PART TIME|FULL TIME/gi, "")
      .trim();
    const cleanLocation = scraped.location.replace(/\s+/g, " ").trim();

    const [existing] = await db
      .select({ id: jobs.id })
      .from(jobs)
      .where(eq(jobs.id, scraped.id))
      .limit(1);

    if (existing) {
      await db
        .update(jobs)
        .set({
          title: cleanTitle,
          location: cleanLocation,
          description: buildDescription(scraped),
          archivedAt: null,
        })
        .where(eq(jobs.id, scraped.id));
    } else {
      await db.insert(jobs).values({
        id: scraped.id,
        title: cleanTitle,
        location: cleanLocation,
        description: buildDescription(scraped),
        recipientEmail: DEFAULT_RECIPIENT,
      });
    }
  }

  // Archive jobs that are no longer on the site
  // Only archive if we actually got results — 0 results likely means scrape failed
  if (scrapedJobs.length > 0) {
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
