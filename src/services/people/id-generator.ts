// No "server-only" guard: this service is also invoked from db/seed.ts via tsx.
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { idSequences } from "@/db/schema";

type PersonType = "EMP" | "INT";

/**
 * Generates the next permanent Bharat Infotechs ID for a person, e.g.
 * BI-EMP-26-00111 or BI-INT-26-00021.
 *
 * This ID is permanent: it never changes when the person moves teams or
 * departments. The sequence counter is per organization + person type +
 * joining year, incremented inside a single UPDATE so two concurrent
 * hires can never collide.
 */
export async function generateEmployeeCode(
  organizationId: string,
  personType: PersonType,
  joiningYear: number
): Promise<string> {
  if (!db) {
    // Demo mode fallback — not used for real records, just keeps the
    // function callable without a database.
    const rand = Math.floor(Math.random() * 90000 + 10000);
    return `BI-${personType}-${String(joiningYear).slice(-2)}-${rand}`;
  }

  // Single atomic upsert: INSERT ... ON CONFLICT DO UPDATE last_number = last_number + 1.
  // Race-free even under concurrent hires — the increment happens inside Postgres,
  // not in application code.
  const [row] = await db
    .insert(idSequences)
    .values({ organizationId, personType, year: joiningYear, lastNumber: 1 })
    .onConflictDoUpdate({
      target: [idSequences.organizationId, idSequences.personType, idSequences.year],
      set: { lastNumber: sql`${idSequences.lastNumber} + 1` },
    })
    .returning({ lastNumber: idSequences.lastNumber });

  const sequence = String(row.lastNumber).padStart(5, "0");
  const yearSuffix = String(joiningYear).slice(-2);
  return `BI-${personType}-${yearSuffix}-${sequence}`;
}
