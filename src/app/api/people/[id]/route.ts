import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { db } from "@/db";
import { users, teams, departments } from "@/db/schema";
import { updatePersonSchema } from "@/validations/people";
import { logActivity } from "@/services/activity/activity.service";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  if (!db) return NextResponse.json({ error: "Not available in demo mode" }, { status: 400 });

  const canViewAll = await hasPermission(session, "people.view");
  if (!canViewAll && session.role !== "SUPER_ADMIN" && session.id !== id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [person] = await db
    .select({
      id: users.id, name: users.name, email: users.email, phone: users.phone,
      role: users.role, status: users.status, employeeCode: users.employeeCode,
      employmentType: users.employmentType, designation: users.designation,
      teamId: users.teamId, teamName: teams.name, departmentId: users.departmentId,
      departmentName: departments.name, reportingManagerId: users.reportingManagerId,
      joiningDate: users.joiningDate, profileImageUrl: users.profileImageUrl,
      createdAt: users.createdAt,
    })
    .from(users)
    .leftJoin(teams, eq(users.teamId, teams.id))
    .leftJoin(departments, eq(users.departmentId, departments.id))
    .where(and(eq(users.id, id), eq(users.organizationId, session.organizationId)));

  if (!person) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ person });
}

export async function PATCH(req: Request, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const allowed = session.role === "SUPER_ADMIN" || (await hasPermission(session, "people.edit"));
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (!db) return NextResponse.json({ error: "Not available in demo mode" }, { status: 400 });

  const body = await req.json().catch(() => null);
  const parsed = updatePersonSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 422 });
  }

  // Status changes (deactivate/reactivate) require the stronger permission.
  if (parsed.data.status !== undefined) {
    const canDeactivate = session.role === "SUPER_ADMIN" || (await hasPermission(session, "people.deactivate"));
    if (!canDeactivate) return NextResponse.json({ error: "Forbidden: cannot change employment status" }, { status: 403 });
  }

  const [before] = await db.select().from(users).where(and(eq(users.id, id), eq(users.organizationId, session.organizationId)));
  if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { password: _ignored, ...updatable } = parsed.data;
  const [updated] = await db
    .update(users)
    .set({ ...updatable, joiningDate: updatable.joiningDate ?? undefined, updatedAt: new Date() })
    .where(and(eq(users.id, id), eq(users.organizationId, session.organizationId)))
    .returning();

  await logActivity({
    organizationId: session.organizationId,
    userId: session.id,
    action: parsed.data.status ? "PERSON_STATUS_CHANGED" : "PERSON_UPDATED",
    entityType: "user",
    entityId: id,
    metadata: { before: { status: before.status }, after: { status: updated.status }, changes: Object.keys(updatable) },
  });

  const { passwordHash: _hash, ...safePerson } = updated;
  return NextResponse.json({ person: safePerson });
}
