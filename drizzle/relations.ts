import { relations } from "drizzle-orm/relations";
import { jobs, candidates, users, uploads } from "./schema";

export const candidatesRelations = relations(candidates, ({one}) => ({
	job: one(jobs, {
		fields: [candidates.jobId],
		references: [jobs.id]
	}),
	user: one(users, {
		fields: [candidates.uploadedBy],
		references: [users.id]
	}),
}));

export const jobsRelations = relations(jobs, ({one, many}) => ({
	candidates: many(candidates),
	user: one(users, {
		fields: [jobs.createdBy],
		references: [users.id]
	}),
	uploads: many(uploads),
}));

export const usersRelations = relations(users, ({many}) => ({
	candidates: many(candidates),
	jobs: many(jobs),
	uploads: many(uploads),
}));

export const uploadsRelations = relations(uploads, ({one}) => ({
	job: one(jobs, {
		fields: [uploads.jobId],
		references: [jobs.id]
	}),
	user: one(users, {
		fields: [uploads.uploadedBy],
		references: [users.id]
	}),
}));