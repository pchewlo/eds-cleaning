import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { jobs } from "@/lib/db/schema";
import { isNull } from "drizzle-orm";
import { sql } from "drizzle-orm";

export async function GET() {
  const session = await auth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const jobList = await db
    .select()
    .from(jobs)
    .where(isNull(jobs.archivedAt))
    .orderBy(sql`${jobs.createdAt} desc`);

  return Response.json(jobList);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { title, location, description, recipientEmail } = body;

  if (!title || !description || !recipientEmail) {
    return Response.json({ error: "Missing required fields" }, { status: 400 });
  }

  const [job] = await db
    .insert(jobs)
    .values({
      title,
      location: location || null,
      description,
      recipientEmail,
    })
    .returning({ id: jobs.id });

  return Response.json(job);
}
