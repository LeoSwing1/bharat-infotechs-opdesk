import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { db } from "@/db";
import { assignments, projects, tasks, users } from "@/db/schema";
import { updateAssignmentSchema } from "@/validations/assignments";
import { canViewProject, canManageProject } from "@/services/projects/access";
import { logActivity } from "@/services/activity/activity.service";

type Params = { params: Promise<{ id: string }> };

async function loadWithProject(organizationId: string, id: string) {
  if (!db) return null;
  const [row] = await db
    .select({ assignment: assignments, project: projects })
    .from(assignments)
    .innerJoin(projects, eq(assignments.projectId, projects.id))
    .where(and(eq(assignments.id, id), eq(assignments.organizationId, organizationId)));
  return row ?? null;
}

export async function GET(_req: Request, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!db) return NextResponse.json({ error: "Not available in demo mode" }, { status: 400 });

  const row = await loadWithProject(session.organizationId, id);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await canViewProject(session, row.project))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const assignedTasks = await db
    .select({
      id: tasks.id, title: tasks.title, status: tasks.status, priority: tasks.priority,
      deadline: tasks.deadline, assigneeId: tasks.assigneeId, assigneeName: users.name,
    })
    .from(tasks)
    .leftJoin(users, eq(tasks.assigneeId, users.id))
    .where(eq(tasks.assignmentId, id));

  return NextResponse.json({ assignment: row.assignment, project: { id: row.project.id, name: row.project.name }, tasks: assignedTasks });
}

export async function PATCH(req: Request, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!db) return NextResponse.json({ error: "Not available in demo mode" }, { status: 400 });

  const row = await loadWithProject(session.organizationId, id);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await canManageProject(session, row.project))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const parsed = updateAssignmentSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 422 });

  const { deadline, ...rest } = parsed.data;
  const [updated] = await db.update(assignments)
    .set({ ...rest, deadline: deadline ? new Date(deadline) : undefined, updatedAt: new Date() })
    .where(eq(assignments.id, id)).returning();

  await logActivity({
    organizationId: session.organizationId, userId: session.id, action: "ASSIGNMENT_UPDATED",
    entityType: "assignment", entityId: id, metadata: { changes: Object.keys(parsed.data) },
  });

  return NextResponse.json({ assignment: updated });
}
