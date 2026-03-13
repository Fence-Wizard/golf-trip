import { neon } from "@neondatabase/serverless";

const databaseUrl = process.env.DATABASE_URL?.trim() ?? "";

export const hasDatabaseUrl = Boolean(databaseUrl);
export const sql = hasDatabaseUrl ? neon(databaseUrl) : null;

