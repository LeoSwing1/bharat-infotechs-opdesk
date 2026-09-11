import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { hasPermission, canAccessTeam } from "@/lib/permissions";
import { db } from "@/db";
import { teams, users, teamMembers, departments } from "@/db/schema";
import { updateTeamSchema } from "@/validations/teams";
import { logActivity } from "@/services/activity/activity.service";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  if (!db) return NextResponse.json({ error: "Not available in demo mode" }, { status: 400 });

  const canView = await canAccessTeam(session, id, "teams.view");
  if (!canView) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [team] = await db
    .select({
      id: teams.id, name: teams.name, code: teams.code, description: teams.description,
      active: teams.active, leadUserId: teams.leadUserId, hrUserId: teams.hrUserId,
      departmentId: teams.departmentId, departmentName: departments.name, createdAt: teams.createdAt,
    })
    .from(teams)
    .leftJoin(departments, eq(teams.departmentId, departments.id))
    .where(and(eq(teams.id, id), eq(teams.organizationId, session.organizationId)));

  if (!team) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const members = await db
    .select({
      id: users.id, name: users.name, email: users.email, role: users.role,
      employeeCode: users.employeeCode, designation: users.designation, status: users.status,
    })
    .from(teamMembers)
    .innerJoin(users, eq(teamMembers.userId, users.id))
    .where(eq(teamMembers.teamId, id));

  return NextResponse.json({ team, members });
}

export async function PATCH(req: Request, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const allowed = await canAccessTeam(session, id, "teams.edit");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (!db) return NextResponse.json({ error: "Not available in demo mode" }, { status: 400 });

  const body = await req.json().catch(() => null);
  const parsed = updateTeamSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 422 });
  }

  // Reassigning TL/HR is a stronger action than editing team description.
  if ((parsed.data.leadUserId !== undefined || parsed.data.hrUserId !== undefined) &&
      session.role !== "SUPER_ADMIN" && !(await hasPermission(session, "teams.assign_authorities"))) {
    return NextResponse.json({ error: "Forbidden: cannot reassign team lead / HR" }, { status: 403 });
  }

  const [existing] = await db.select().from(teams).where(and(eq(teams.id, id), eq(teams.organizationId, session.organizationId)));
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const nextCode = parsed.data.code ? parsed.data.code.toUpperCase() : undefined;

  const [updated] = await db
    .update(teams)
    .set({ ...parsed.data, code: nextCode })
    .where(and(eq(teams.id, id), eq(teams.organizationId, session.organizationId)))
    .returning();

  await logActivity({
    organizationId: session.organizationId,
    userId: session.id,
    action: parsed.data.active === false ? "TEAM_ARCHIVED" : "TEAM_UPDATED",
    entityType: "team",
    entityId: id,
    metadata: { changes: Object.keys(parsed.data) },
  });

  return NextResponse.json({ team: updated });
}
