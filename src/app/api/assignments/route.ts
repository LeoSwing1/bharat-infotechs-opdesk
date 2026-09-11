import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { db } from "@/db";
import { assignments, projects, tasks, users } from "@/db/schema";
import { createAssignmentSchema } from "@/validations/assignments";
import { canViewProject, canManageProject } from "@/services/projects/access";
import { logActivity } from "@/services/activity/activity.service";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (process.env.DEMO_MODE === "true" || !db) return NextResponse.json({ assignments: [] });

  const url = new URL(req.url);
  const projectId = url.searchParams.get("projectId");
  if (!projectId) return NextResponse.json({ error: "projectId is required" }, { status: 422 });

  const [project] = await db.select().from(projects).where(and(eq(projects.id, projectId), eq(projects.organizationId, session.organizationId)));
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  if (!(await canViewProject(session, project))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const owner = users;
  const rows = await db
    .select({
      id: assignments.id, name: assignments.name, description: assignments.description,
      status: assignments.status, deadline: assignments.deadline,
      ownerId: assignments.ownerId, ownerName: owner.name,
      taskTotal: sql<number>`count(${tasks.id})`.mapWith(Number),
      taskCompleted: sql<number>`count(*) filter (where ${tasks.status} = 'APPROVED')`.mapWith(Number),
    })
    .from(assignments)
    .leftJoin(owner, eq(assignments.ownerId, owner.id))
    .leftJoin(tasks, eq(tasks.assignmentId, assignments.id))
    .where(eq(assignments.projectId, projectId))
    .groupBy(assignments.id, owner.name);

  return NextResponse.json({ assignments: rows });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (process.env.DEMO_MODE === "true") {
    return NextResponse.json({ error: "Creating assignments is disabled in demo mode. Connect a database to enable this." }, { status: 400 });
  }
  if (!db) return NextResponse.json({ error: "Database not configured" }, { status: 500 });

  const body = await req.json().catch(() => null);
  const parsed = createAssignmentSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 422 });
  const input = parsed.data;

  const [project] = await db.select().from(projects).where(and(eq(projects.id, input.projectId), eq(projects.organizationId, session.organizationId)));
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  if (!(await canManageProject(session, project))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [created] = await db.insert(assignments).values({
    organizationId: session.organizationId,
    projectId: input.projectId,
    name: input.name,
    description: input.description ?? null,
    ownerId: input.ownerId ?? null,
    teamId: input.teamId ?? project.teamId ?? null,
    deadline: input.deadline ? new Date(input.deadline) : null,
  }).returning();

  await logActivity({
    organizationId: session.organizationId, userId: session.id, action: "ASSIGNMENT_CREATED",
    entityType: "assignment", entityId: created.id, metadata: { name: created.name, projectId: input.projectId },
  });

  return NextResponse.json({ assignment: created }, { status: 201 });
}
