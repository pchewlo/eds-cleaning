import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL!;
const client = postgres(connectionString, {
  max: 1,              // Serverless: one connection per invocation
  idle_timeout: 20,    // Close idle connections after 20s
  connect_timeout: 10, // Don't hang forever on connect
});
export const db = drizzle(client, { schema });
