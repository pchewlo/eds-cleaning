import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  numeric,
  integer,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const users = pgTable("users", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  email: text("email").unique().notNull(),
  name: text("name"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const jobs = pgTable("jobs", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  title: text("title").notNull(),
  location: text("location"),
  description: text("description").notNull(),
  criteriaJson: jsonb("criteria_json"),
  recipientEmail: text("recipient_email").notNull(),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  archivedAt: timestamp("archived_at"),
});

export const candidates = pgTable(
  "candidates",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    jobId: text("job_id")
      .references(() => jobs.id, { onDelete: "cascade" })
      .notNull(),
    name: text("name"),
    email: text("email"),
    phone: text("phone"),
    cvBlobUrl: text("cv_blob_url").notNull(),
    cvText: text("cv_text"),
    fileHash: text("file_hash").notNull(),
    metadataJson: jsonb("metadata_json"),
    rankScore: numeric("rank_score"),
    rankReasoning: text("rank_reasoning"),
    rankFlags: jsonb("rank_flags"),
    uploadedBy: uuid("uploaded_by").references(() => users.id),
    uploadedAt: timestamp("uploaded_at").defaultNow(),
    rankedAt: timestamp("ranked_at"),
  },
  (table) => [
    uniqueIndex("candidates_job_id_file_hash_idx").on(
      table.jobId,
      table.fileHash
    ),
    index("candidates_job_id_rank_score_idx").on(table.jobId, table.rankScore),
  ]
);

export const uploads = pgTable("uploads", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  jobId: text("job_id").references(() => jobs.id),
  uploadedBy: uuid("uploaded_by").references(() => users.id),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
  newCount: integer("new_count"),
  duplicateCount: integer("duplicate_count"),
  digestSentAt: timestamp("digest_sent_at"),
  digestError: text("digest_error"),
});
