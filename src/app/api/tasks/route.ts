import { NextResponse } from "next/server";
import { and, desc, eq, inArray, or } from "drizzle-orm";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { hasPermission, canAccessTeam } from "@/lib/permissions";
import { db } from "@/db";
import { tasks, teams, teamMembers } from "@/db/schema";
import { demoTasks } from "@/lib/demo";
import { notifyTaskAssigned } from "@/services/notifications/notification.service";

const taskSchema = z.object({
  title: z.string().min(2).max(200),
  description: z.string().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  deadline: z.string().optional(),
  assigneeId: z.string().min(1).optional(),
  teamId: z.string().min(1).optional(),
  projectId: z.string().uuid().optional(),
  assignmentId: z.string().uuid().optional(),
});

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (process.env.DEMO_MODE === "true") return NextResponse.json({ tasks: demoTasks });
  if (!db) return NextResponse.json({ tasks: [] });

  const canViewAll = session.role === "SUPER_ADMIN" ||
    (session.role === "HR_MANAGER" && (await hasPermission(session, "tasks.view")));

  if (canViewAll) {
    const rows = await db.select().from(tasks).where(eq(tasks.organizationId, session.organizationId)).orderBy(desc(tasks.createdAt));
    return NextResponse.json({ tasks: rows });
  }

  if (session.role === "MANAGER") {
    const reports = await db.select({ id: users.id }).from(users).where(and(eq(users.organizationId, session.organizationId), eq(users.reportingManagerId, session.id)));
    const ids = Array.from(new Set([session.id, ...reports.map(r => r.id)]));
    const rows = await db.select().from(tasks).where(and(eq(tasks.organizationId, session.organizationId), or(eq(tasks.assigneeId, session.id), inArray(tasks.assigneeId, ids), eq(tasks.creatorId, session.id)))).orderBy(desc(tasks.createdAt));
    return NextResponse.json({ tasks: rows });
  }

  if (session.role === "TEAM_LEAD") {
    const ownedTeams = await db.select({ id: teams.id }).from(teams).where(eq(teams.leadUserId, session.id));
    const teamIds = ownedTeams.map(t => t.id);
    const conditions = [eq(tasks.assigneeId, session.id), eq(tasks.creatorId, session.id)];
    if (teamIds.length > 0) conditions.push(inArray(tasks.teamId, teamIds));
    const rows = await db.select().from(tasks)
      .where(and(eq(tasks.organizationId, session.organizationId), or(...conditions)))
      .orderBy(desc(tasks.createdAt));
    return NextResponse.json({ tasks: rows });
  }

  // Everyone else: only tasks assigned to them or created by them.
  const rows = await db.select().from(tasks)
    .where(and(eq(tasks.organizationId, session.organizationId), or(eq(tasks.assigneeId, session.id), eq(tasks.creatorId, session.id))))
    .orderBy(desc(tasks.createdAt));
  return NextResponse.json({ tasks: rows });
}

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const parsed = taskSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Invalid task data" }, { status: 400 });

    const { title, description, priority, deadline, assigneeId, teamId, projectId, assignmentId } = parsed.data;

    if (process.env.DEMO_MODE === "true") {
      const taskId = `demo-task-${Date.now()}`;
      const task = {
        id: taskId, title, description: description || "", priority, status: "ASSIGNED",
        assigneeId: assigneeId || null, teamId: teamId || null, deadline: deadline || null,
        creatorId: session.id, organizationId: session.organizationId,
      };
      if (assigneeId) await notifyTaskAssigned({ organizationId: session.organizationId, userId: assigneeId, taskId, taskTitle: title });
      return NextResponse.json({ ok: true, demo: true, task }, { status: 201 });
    }

    if (!db) return NextResponse.json({ error: "Database is not configured" }, { status: 500 });

    // Every role needs tasks.create, and non-admins must be authorized for
    // the specific team they're assigning into — otherwise anyone could
    // create and assign tasks across teams they have no authority over.
    const canCreate = session.role === "SUPER_ADMIN" || (await hasPermission(session, "tasks.create"));
    if (!canCreate) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    if (teamId && session.role !== "SUPER_ADMIN") {
      const authorizedForTeam = await canAccessTeam(session, teamId, "tasks.create");
      if (!authorizedForTeam) return NextResponse.json({ error: "Forbidden: no authority over that team" }, { status: 403 });
    }

    // If assigning to a specific person (not just a team), confirm that
    // person is actually reachable by this creator — either on an
    // authorized team, or the creator has org-wide tasks.assign.
    if (assigneeId && assigneeId !== session.id && session.role !== "SUPER_ADMIN") {
      const [assigneeTeam] = await db.select({ teamId: teamMembers.teamId }).from(teamMembers).where(eq(teamMembers.userId, assigneeId));
      const orgWideAssign = await hasPermission(session, "tasks.assign");
      const teamAssign = assigneeTeam ? await canAccessTeam(session, assigneeTeam.teamId, "tasks.assign") : false;
      if (!orgWideAssign && !teamAssign) return NextResponse.json({ error: "Forbidden: cannot assign tasks to that person" }, { status: 403 });
    }

    const [task] = await db.insert(tasks).values({
      organizationId: session.organizationId,
      creatorId: session.id,
      title, description, priority, assigneeId, teamId,
      projectId: projectId ?? null,
      assignmentId: assignmentId ?? null,
      deadline: deadline ? new Date(deadline) : undefined,
    }).returning();

    if (assigneeId && task) {
      await notifyTaskAssigned({ organizationId: session.organizationId, userId: assigneeId, taskId: task.id, taskTitle: task.title });
    }

    return NextResponse.json({ task }, { status: 201 });
  } catch (error) {
    console.error("Create task error:", error);
    return NextResponse.json({ error: "Unable to create task" }, { status: 500 });
  }
}
