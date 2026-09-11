// Deliberately no "server-only" guard here: this module is imported both by
// the Next.js server (API routes) and by standalone scripts run via tsx
// (db/seed.ts, CLI tooling). The real "server-only" package throws
// unconditionally outside Next's bundler, which would break those scripts.
// A client bundle can't use this module anyway since it depends on "pg".
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

let pool: Pool | undefined;

export function getDb() {
  // Demo mode does not require PostgreSQL.
  if (process.env.DEMO_MODE === "true") {
    return null;
  }

  if (!process.env.DATABASE_URL) {
    // Keep route imports/builds alive when a developer has not configured
    // PostgreSQL yet. API routes can return a clear 503/feature-disabled
    // response instead of crashing the entire request with an import error.
    return null;
  }

  pool ??= new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  return drizzle(pool, { schema });
}

export const db = getDb();