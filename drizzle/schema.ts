import { pgTable, uniqueIndex, index, foreignKey, uuid, text, jsonb, numeric, timestamp, integer, unique } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const candidates = pgTable("candidates", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	jobId: uuid("job_id").notNull(),
	name: text(),
	email: text(),
	phone: text(),
	cvBlobUrl: text("cv_blob_url").notNull(),
	cvText: text("cv_text"),
	fileHash: text("file_hash").notNull(),
	metadataJson: jsonb("metadata_json"),
	rankScore: numeric("rank_score"),
	rankReasoning: text("rank_reasoning"),
	rankFlags: jsonb("rank_flags"),
	uploadedBy: uuid("uploaded_by"),
	uploadedAt: timestamp("uploaded_at", { mode: 'string' }).defaultNow(),
	rankedAt: timestamp("ranked_at", { mode: 'string' }),
}, (table) => [
	uniqueIndex("candidates_job_id_file_hash_idx").using("btree", table.jobId.asc().nullsLast().op("text_ops"), table.fileHash.asc().nullsLast().op("text_ops")),
	index("candidates_job_id_rank_score_idx").using("btree", table.jobId.asc().nullsLast().op("uuid_ops"), table.rankScore.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.jobId],
			foreignColumns: [jobs.id],
			name: "candidates_job_id_jobs_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.uploadedBy],
			foreignColumns: [users.id],
			name: "candidates_uploaded_by_users_id_fk"
		}),
]);

export const jobs = pgTable("jobs", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	title: text().notNull(),
	location: text(),
	description: text().notNull(),
	criteriaJson: jsonb("criteria_json"),
	recipientEmail: text("recipient_email").notNull(),
	createdBy: uuid("created_by"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	archivedAt: timestamp("archived_at", { mode: 'string' }),
}, (table) => [
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "jobs_created_by_users_id_fk"
		}),
]);

export const uploads = pgTable("uploads", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	jobId: uuid("job_id"),
	uploadedBy: uuid("uploaded_by"),
	uploadedAt: timestamp("uploaded_at", { mode: 'string' }).defaultNow(),
	newCount: integer("new_count"),
	duplicateCount: integer("duplicate_count"),
	digestSentAt: timestamp("digest_sent_at", { mode: 'string' }),
	digestError: text("digest_error"),
}, (table) => [
	foreignKey({
			columns: [table.jobId],
			foreignColumns: [jobs.id],
			name: "uploads_job_id_jobs_id_fk"
		}),
	foreignKey({
			columns: [table.uploadedBy],
			foreignColumns: [users.id],
			name: "uploads_uploaded_by_users_id_fk"
		}),
]);

export const users = pgTable("users", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	email: text().notNull(),
	name: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	unique("users_email_unique").on(table.email),
]);
