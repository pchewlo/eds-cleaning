import { getJobs } from "@/lib/scraper";

export async function GET() {
  try {
    const jobs = await getJobs();
    return Response.json({ jobs });
  } catch (error) {
    console.error("Failed to fetch jobs:", error);
    return Response.json(
      { error: "Could not load jobs. Please try again." },
      { status: 500 }
    );
  }
}
