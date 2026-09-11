import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { db } from "@/db";
import { projects, projectMembers, users, teams, assignments, tasks } from "@/db/schema";
import { updateProjectSchema } from "@/validations/projects";
import { logActivity } from "@/services/activity/activity.service";
import { canViewProject, canManageProject } from "@/services/projects/access";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!db) return NextResponse.json({ error: "Not available in demo mode" }, { status: 400 });

  const [project] = await db
    .select({
      id: projects.id, name: projects.name, description: projects.description,
      kind: projects.kind, clientName: projects.clientName, status: projects.status,
      startDate: projects.startDate, endDate: projects.endDate,
      teamId: projects.teamId, teamName: teams.name,
      managerId: projects.managerId, managerName: users.name,
      createdAt: projects.createdAt,
    })
    .from(projects)
    .leftJoin(teams, eq(projects.teamId, teams.id))
    .leftJoin(users, eq(projects.managerId, users.id))
    .where(and(eq(projects.id, id), eq(projects.organizationId, session.organizationId)));

  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await canViewProject(session, project))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const assignmentRows = await db.select().from(assignments).where(eq(assignments.projectId, id));

  const [taskStats] = await db
    .select({
      total: sql<number>`count(*)`.mapWith(Number),
      completed: sql<number>`count(*) filter (where ${tasks.status} = 'APPROVED')`.mapWith(Number),
      overdue: sql<number>`count(*) filter (where ${tasks.deadline} < now() and ${tasks.status} not in ('APPROVED','REJECTED'))`.mapWith(Number),
    })
    .from(tasks)
    .where(eq(tasks.projectId, id));

  const progress = taskStats.total > 0 ? Math.round((taskStats.completed / taskStats.total) * 100) : 0;

  const members = await db
    .select({ id: users.id, name: users.name, email: users.email, role: users.role })
    .from(projectMembers)
    .innerJoin(users, eq(projectMembers.userId, users.id))
    .where(eq(projectMembers.projectId, id));

  return NextResponse.json({ project, assignments: assignmentRows, members, taskStats: { ...taskStats, progress } });
}

export async function PATCH(req: Request, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!db) return NextResponse.json({ error: "Not available in demo mode" }, { status: 400 });

  const [existing] = await db.select().from(projects).where(and(eq(projects.id, id), eq(projects.organizationId, session.organizationId)));
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const allowed = await canManageProject(session, existing);
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const parsed = updateProjectSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 422 });

  const [updated] = await db.update(projects).set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(projects.id, id)).returning();

  await logActivity({
    organizationId: session.organizationId, userId: session.id, action: "PROJECT_UPDATED",
    entityType: "project", entityId: id, metadata: { changes: Object.keys(parsed.data) },
  });

  return NextResponse.json({ project: updated });
}
