import { NextResponse } from "next/server";
import { and, eq, ilike, or, inArray } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { getSession } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { db } from "@/db";
import { users, teams, departments } from "@/db/schema";
import { demoUsers } from "@/lib/demo";
import { createPersonSchema } from "@/validations/people";
import { generateEmployeeCode } from "@/services/people/id-generator";
import { generateEmailForPerson } from "@/services/people/email-generator";
import { logActivity } from "@/services/activity/activity.service";
import { sendWelcomeEmail } from "@/services/email/welcome-email";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const search = url.searchParams.get("search")?.trim();
  const teamId = url.searchParams.get("teamId") ?? undefined;
  const status = url.searchParams.get("status") ?? undefined;

  if (process.env.DEMO_MODE === "true") {
    let people = demoUsers;
    if (search) {
      const q = search.toLowerCase();
      people = people.filter(p => p.name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q));
    }
    return NextResponse.json({ people });
  }

  if (!db) return NextResponse.json({ people: [] });

  const canViewAll = await hasPermission(session, "people.view");
  if (session.role === "MANAGER") {
    const reports = await db.select({ id: users.id }).from(users).where(and(eq(users.organizationId, session.organizationId), eq(users.reportingManagerId, session.id)));
    const ids = Array.from(new Set([session.id, ...reports.map(r => r.id)]));
    const rows = await db.select({
      id: users.id, name: users.name, email: users.email, phone: users.phone, role: users.role, status: users.status, employeeCode: users.employeeCode, employmentType: users.employmentType, designation: users.designation, teamId: users.teamId, teamName: teams.name, departmentId: users.departmentId, departmentName: departments.name, joiningDate: users.joiningDate, profileImageUrl: users.profileImageUrl,
    }).from(users).leftJoin(teams, eq(users.teamId, teams.id)).leftJoin(departments, eq(users.departmentId, departments.id)).where(and(eq(users.organizationId, session.organizationId), inArray(users.id, ids)));
    return NextResponse.json({ people: rows });
  }
  if (!canViewAll && session.role !== "SUPER_ADMIN") {
    // Employees/interns without an org-wide people.view grant can only see themselves.
    const self = await db
      .select()
      .from(users)
      .where(eq(users.id, session.id));
    return NextResponse.json({ people: self });
  }

  const conditions = [eq(users.organizationId, session.organizationId)];
  if (teamId) conditions.push(eq(users.teamId, teamId));
  if (status) conditions.push(eq(users.status, status as "ACTIVE" | "INACTIVE" | "SUSPENDED"));
  if (search) {
    const searchCondition = or(ilike(users.name, `%${search}%`), ilike(users.email, `%${search}%`), ilike(users.employeeCode, `%${search}%`));
    if (searchCondition) conditions.push(searchCondition);
  }

  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
      role: users.role,
      status: users.status,
      employeeCode: users.employeeCode,
      employmentType: users.employmentType,
      designation: users.designation,
      teamId: users.teamId,
      teamName: teams.name,
      departmentId: users.departmentId,
      departmentName: departments.name,
      joiningDate: users.joiningDate,
      profileImageUrl: users.profileImageUrl,
    })
    .from(users)
    .leftJoin(teams, eq(users.teamId, teams.id))
    .leftJoin(departments, eq(users.departmentId, departments.id))
    .where(and(...conditions));

  return NextResponse.json({ people: rows });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const allowed = session.role === "SUPER_ADMIN" || (await hasPermission(session, "people.create"));
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (process.env.DEMO_MODE === "true") {
    return NextResponse.json({ error: "Creating people is disabled in demo mode. Connect a database to enable this." }, { status: 400 });
  }
  if (!db) return NextResponse.json({ error: "Database not configured" }, { status: 500 });

  const body = await req.json().catch(() => null);
  const parsed = createPersonSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 422 });
  }
  const input = parsed.data;

  const joiningDate = input.joiningDate ? new Date(input.joiningDate) : new Date();
  const personType = input.employmentType === "INTERN" ? "INT" : "EMP";
  const employeeCode = await generateEmployeeCode(session.organizationId, personType, joiningDate.getFullYear());

  // If no email was given, generate one following the Bharat Infotechs
  // convention (interns get @internsbharatinfotechs.com) instead of
  // requiring HR to invent one for every hire.
  const email = input.email ?? await generateEmailForPerson(session.organizationId, input.name, personType);

  const [existingEmail] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.organizationId, session.organizationId), eq(users.email, email)));
  if (existingEmail) {
    return NextResponse.json({ error: "A person with this email already exists in your organization" }, { status: 409 });
  }

  const tempPassword = input.password ?? Math.random().toString(36).slice(2, 10) + "Aa1!";
  const passwordHash = await bcrypt.hash(tempPassword, 12);

  const [created] = await db
    .insert(users)
    .values({
      organizationId: session.organizationId,
      departmentId: input.departmentId ?? null,
      teamId: input.teamId ?? null,
      shiftId: input.shiftId ?? null,
      name: input.name,
      email,
      phone: input.phone ?? null,
      passwordHash,
      role: input.role,
      employmentType: input.employmentType,
      employeeCode,
      designation: input.designation ?? null,
      reportingManagerId: input.reportingManagerId ?? null,
      joiningDate: joiningDate.toISOString().slice(0, 10),
    })
    .returning();

  await logActivity({
    organizationId: session.organizationId,
    userId: session.id,
    action: "PERSON_CREATED",
    entityType: "user",
    entityId: created.id,
    metadata: { name: created.name, employeeCode: created.employeeCode, role: created.role },
  });

  // The admin's UI only shows the temporary password once — email is the
  // one automated way the new hire actually receives it. Awaited so it
  // completes within the request lifecycle, but never lets an email
  // failure fail account creation (sendEmail already never throws; this
  // is an extra guard in case that ever changes).
  let welcomeEmailSent = false;
  if (!input.password) {
    try {
      const result = await sendWelcomeEmail({
        organizationId: session.organizationId,
        name: created.name,
        email: created.email,
        employeeCode: created.employeeCode ?? "",
        temporaryPassword: tempPassword,
        designation: created.designation,
      });
      welcomeEmailSent = result.ok;
    } catch (err) {
      console.error("Welcome email failed for", created.email, err);
    }
  }

  const { passwordHash: _hash, ...safePerson } = created;

  return NextResponse.json({
    person: safePerson,
    // Only returned once, at creation time, so the admin can share it securely.
    temporaryPassword: input.password ? undefined : tempPassword,
    welcomeEmailSent,
  }, { status: 201 });
}
