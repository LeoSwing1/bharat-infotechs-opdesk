import { and, eq, ilike } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";

type PersonType = "EMP" | "INT";

/**
 * Bharat Infotechs email convention:
 *   Employees / contractors / freelancers -> firstname@bharatinfotechs.com
 *   Interns / trainees                    -> firstname@internsbharatinfotechs.com
 *
 * This mirrors the permanent employee-ID scheme (BI-EMP-.../BI-INT-...) —
 * the domain itself signals employment type at a glance, e.g.
 * rahul@internsbharatinfotechs.com for an intern named Rahul.
 *
 * Used only when an admin doesn't supply a specific email at creation
 * time — a custom email is always allowed and takes precedence.
 */
export async function generateEmailForPerson(
  organizationId: string,
  fullName: string,
  personType: PersonType
): Promise<string> {
  const domain = personType === "INT" ? "internsbharatinfotechs.com" : "bharatinfotechs.com";

  const localPart = fullName
    .trim()
    .toLowerCase()
    .split(/\s+/)[0] // first name only, matching the example convention
    .replace(/[^a-z0-9]/g, "") || "employee";

  if (!db) return `${localPart}@${domain}`;

  // Avoid collisions: rahul@..., then rahul2@..., rahul3@..., etc.
  let candidate = `${localPart}@${domain}`;
  let suffix = 2;
  while (await emailTaken(organizationId, candidate)) {
    candidate = `${localPart}${suffix}@${domain}`;
    suffix += 1;
  }
  return candidate;
}

async function emailTaken(organizationId: string, email: string): Promise<boolean> {
  if (!db) return false;
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.organizationId, organizationId), ilike(users.email, email)));
  return Boolean(existing);
}
