import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import type { SessionUser } from "@/lib/auth";
import { hasPermission, canAccessTeam } from "@/lib/permissions";
import { db } from "@/db";
import { tasks, taskComments, taskSubmissions } from "@/db/schema";
import { taskTransitionSchema } from "@/validations/task-transitions";
import { createNotification } from "@/services/notifications/notification.service";
import { logActivity } from "@/services/activity/activity.service";

type Params = { params: Promise<{ id: string }> };

async function canReviewTask(session: SessionUser, task: { teamId: string | null; creatorId: string | null }) {
  if (session.role === "SUPER_ADMIN") return true;
  if (task.creatorId === session.id) return true;
  if (task.teamId) return canAccessTeam(session, task.teamId, "tasks.review");
  return hasPermission(session, "tasks.review");
}

export async function GET(_req: Request, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!db) return NextResponse.json({ error: "Not available in demo mode" }, { status: 400 });

  const [task] = await db.select().from(tasks).where(and(eq(tasks.id, id), eq(tasks.organizationId, session.organizationId)));
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isParty = task.assigneeId === session.id || task.creatorId === session.id;
  if (!isParty && session.role !== "SUPER_ADMIN") {
    const allowed = task.teamId ? await canAccessTeam(session, task.teamId, "tasks.view") : false;
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [comments, submissions] = await Promise.all([
    db.select().from(taskComments).where(eq(taskComments.taskId, id)).orderBy(taskComments.createdAt),
    db.select().from(taskSubmissions).where(eq(taskSubmissions.taskId, id)).orderBy(taskSubmissions.createdAt),
  ]);

  return NextResponse.json({ task, comments, submissions });
}

export async function PATCH(req: Request, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!db) return NextResponse.json({ error: "Not available in demo mode" }, { status: 400 });

  const body = await req.json().catch(() => null);
  const parsed = taskTransitionSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 422 });
  const { action, comment } = parsed.data;

  const [task] = await db.select().from(tasks).where(and(eq(tasks.id, id), eq(tasks.organizationId, session.organizationId)));
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isAssignee = task.assigneeId === session.id;
  let nextStatus: typeof task.status;

  switch (action) {
    case "START":
      if (!isAssignee) return NextResponse.json({ error: "Only the assignee can start this task" }, { status: 403 });
      if (task.status !== "ASSIGNED") return NextResponse.json({ error: `Cannot start a task that is ${task.status}` }, { status: 400 });
      nextStatus = "STARTED";
      break;

    case "SUBMIT":
      if (!isAssignee) return NextResponse.json({ error: "Only the assignee can submit this task" }, { status: 403 });
      if (task.status !== "STARTED") return NextResponse.json({ error: `Cannot submit a task that is ${task.status}` }, { status: 400 });
      nextStatus = "SUBMITTED";
      await db.insert(taskSubmissions).values({ taskId: id, submittedBy: session.id, notes: comment ?? null });
      break;

    case "APPROVE":
    case "REJECT": {
      const canReview = await canReviewTask(session, task);
      if (!canReview) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      if (task.status !== "SUBMITTED" && task.status !== "UNDER_REVIEW") {
        return NextResponse.json({ error: `Cannot review a task that is ${task.status}` }, { status: 400 });
      }
      if (action === "REJECT" && !comment) {
        return NextResponse.json({ error: "A reason is required when rejecting a task" }, { status: 422 });
      }
      nextStatus = action === "APPROVE" ? "APPROVED" : "REJECTED";
      break;
    }

    case "REOPEN":
      if (!isAssignee) return NextResponse.json({ error: "Only the assignee can reopen this task" }, { status: 403 });
      if (task.status !== "REJECTED") return NextResponse.json({ error: `Cannot reopen a task that is ${task.status}` }, { status: 400 });
      nextStatus = "STARTED";
      break;
  }

  const [updated] = await db.update(tasks)
    .set({
      status: nextStatus,
      rejectionReason: action === "REJECT" ? comment : (action === "REOPEN" ? null : undefined),
      updatedAt: new Date(),
    })
    .where(eq(tasks.id, id)).returning();

  if (comment) {
    await db.insert(taskComments).values({ taskId: id, authorId: session.id, message: comment });
  }

  // Notify the other party in the review loop.
  if ((action === "APPROVE" || action === "REJECT") && task.assigneeId) {
    await createNotification({
      organizationId: session.organizationId, userId: task.assigneeId, type: "TASK_REVIEWED",
      title: `Task ${action === "APPROVE" ? "approved" : "rejected"}`, message: task.title,
      link: `/tasks/${id}`,
    });
  } else if (action === "SUBMIT" && task.creatorId && task.creatorId !== session.id) {
    await createNotification({
      organizationId: session.organizationId, userId: task.creatorId, type: "TASK_SUBMITTED",
      title: "Task submitted for review", message: task.title, link: `/tasks/${id}`,
    });
  }

  await logActivity({
    organizationId: session.organizationId, userId: session.id, action: `TASK_${action}`,
    entityType: "task", entityId: id, metadata: { from: task.status, to: nextStatus },
  });

  return NextResponse.json({ task: updated });
}
