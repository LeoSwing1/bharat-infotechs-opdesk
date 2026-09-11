import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { getSession } from "@/lib/auth";
import { canAccessTeam } from "@/lib/permissions";
import { db } from "@/db";
import { projects, projectMembers, users, teams } from "@/db/schema";
import { createProjectSchema } from "@/validations/projects";
import { logActivity } from "@/services/activity/activity.service";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (process.env.DEMO_MODE === "true" || !db) return NextResponse.json({ projects: [] });

  const manager = alias(users, "manager");
  const rows = await db
    .select({
      id: projects.id, name: projects.name, description: projects.description,
      kind: projects.kind, clientName: projects.clientName, status: projects.status,
      startDate: projects.startDate, endDate: projects.endDate,
      teamId: projects.teamId, teamName: teams.name,
      managerId: projects.managerId, managerName: manager.name,
      createdAt: projects.createdAt,
    })
    .from(projects)
    .leftJoin(teams, eq(projects.teamId, teams.id))
    .leftJoin(manager, eq(projects.managerId, manager.id))
    .where(eq(projects.organizationId, session.organizationId));

  if (session.role === "SUPER_ADMIN") return NextResponse.json({ projects: rows });

  // Filter to: projects on a team the person has projects.view authority
  // over, projects they manage, or projects they're an explicit member of.
  const distinctTeamIds = Array.from(new Set(rows.map(r => r.teamId).filter((id): id is string => Boolean(id))));
  const teamAccess = new Map<string, boolean>();
  await Promise.all(distinctTeamIds.map(async id => teamAccess.set(id, await canAccessTeam(session, id, "projects.view"))));

  const memberRows = await db.select({ projectId: projectMembers.projectId }).from(projectMembers).where(eq(projectMembers.userId, session.id));
  const memberProjectIds = new Set(memberRows.map(m => m.projectId));

  const visible = rows.filter(r =>
    (r.teamId && teamAccess.get(r.teamId)) ||
    r.managerId === session.id ||
    memberProjectIds.has(r.id)
  );

  return NextResponse.json({ projects: visible });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (process.env.DEMO_MODE === "true") {
    return NextResponse.json({ error: "Creating projects is disabled in demo mode. Connect a database to enable this." }, { status: 400 });
  }
  if (!db) return NextResponse.json({ error: "Database not configured" }, { status: 500 });

  const body = await req.json().catch(() => null);
  const parsed = createProjectSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 422 });
  const input = parsed.data;

  if (session.role !== "SUPER_ADMIN") {
    // Non-admins must scope the project to a team they actually have
    // project-management authority over — otherwise anyone with
    // projects.manage could spin up untracked, unscoped projects.
    if (!input.teamId || !(await canAccessTeam(session, input.teamId, "projects.manage"))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const [created] = await db.insert(projects).values({
    organizationId: session.organizationId,
    name: input.name,
    description: input.description ?? null,
    kind: input.kind,
    clientName: input.clientName ?? null,
    managerId: input.managerId ?? session.id,
    teamId: input.teamId ?? null,
    startDate: input.startDate ?? null,
    endDate: input.endDate ?? null,
  }).returning();

  await logActivity({
    organizationId: session.organizationId, userId: session.id, action: "PROJECT_CREATED",
    entityType: "project", entityId: created.id, metadata: { name: created.name },
  });

  return NextResponse.json({ project: created }, { status: 201 });
}
