import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { getSession } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { users, warnings, warningApprovals } from "@/db/schema";
import { createNotification } from "@/services/notifications/notification.service";
import { logActivity } from "@/services/activity/activity.service";

const createSchema = z.object({
  userId: z.string().uuid(),
  type: z.enum(["REMINDER", "FIRST_WARNING", "SECOND_WARNING", "ESCALATION"]),
  reason: z.string().trim().min(3).max(2000),
  notes: z.string().max(4000).optional(),
  approverId: z.string().uuid().optional(),
  relatedEntityType: z.string().max(80).optional(),
  relatedEntityId: z.string().uuid().optional(),
});

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!db) return NextResponse.json({ warnings: [] });

  const canView = session.role === "SUPER_ADMIN" || await hasPermission(session, "warnings.view");
  const rows = canView
    ? await db.select({ warning: warnings, userName: users.name, userEmail: users.email })
      .from(warnings).innerJoin(users, eq(warnings.userId, users.id))
      .where(eq(warnings.organizationId, session.organizationId)).orderBy(desc(warnings.createdAt))
    : await db.select({ warning: warnings, userName: users.name, userEmail: users.email })
      .from(warnings).innerJoin(users, eq(warnings.userId, users.id))
      .where(and(eq(warnings.organizationId, session.organizationId), eq(warnings.userId, session.id)))
      .orderBy(desc(warnings.createdAt));

  const approvals = await db.select().from(warningApprovals)
    .where(and(eq(warningApprovals.organizationId, session.organizationId), eq(warningApprovals.approverId, session.id), eq(warningApprovals.status, "PENDING")));

  return NextResponse.json({ warnings: rows, pendingApprovals: approvals });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!db) return NextResponse.json({ error: "Database not configured" }, { status: 500 });

  const canRequest = session.role === "SUPER_ADMIN" || await hasPermission(session, "warnings.request");
  if (!canRequest) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 422 });
  const input = parsed.data;

  const [target] = await db.select({
    id: users.id, organizationId: users.organizationId, name: users.name, reportingManagerId: users.reportingManagerId,
  }).from(users).where(and(eq(users.id, input.userId), eq(users.organizationId, session.organizationId), eq(users.status, "ACTIVE")));
  if (!target) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

  // Team Leads always go through the approval chain. Super Admin/HR or another
  // role with direct issue authority may issue without an approval request.
  const requiresApproval = session.role === "TEAM_LEAD";
  let approverId = input.approverId ?? target.reportingManagerId ?? undefined;

  if (requiresApproval && !approverId) {
    return NextResponse.json({ error: "An approving manager is required for a Team Lead warning request" }, { status: 422 });
  }
  if (approverId === session.id) {
    return NextResponse.json({ error: "The requester cannot approve their own warning" }, { status: 422 });
  }

  if (requiresApproval && approverId) {
    const [approver] = await db.select({ id: users.id, role: users.role }).from(users).where(and(
      eq(users.id, approverId), eq(users.organizationId, session.organizationId), eq(users.status, "ACTIVE")
    ));
    if (!approver || !["SUPER_ADMIN", "HR_MANAGER", "MANAGER", "TEAM_LEAD"].includes(approver.role)) {
      return NextResponse.json({ error: "Approving manager not found or not authorized" }, { status: 404 });
    }
  }

  const [warning] = await db.insert(warnings).values({
    organizationId: session.organizationId,
    userId: input.userId,
    issuedBy: session.id,
    type: input.type,
    reason: input.reason,
    notes: input.notes ?? null,
    relatedEntityType: input.relatedEntityType ?? null,
    relatedEntityId: input.relatedEntityId ?? null,
  }).returning();

  if (requiresApproval && approverId) {
    const [approval] = await db.insert(warningApprovals).values({
      organizationId: session.organizationId,
      warningId: warning.id,
      requestedBy: session.id,
      approverId,
      status: "PENDING",
    }).returning();

    await createNotification({
      organizationId: session.organizationId,
      userId: approverId,
      type: "SYSTEM",
      title: "Warning approval requested",
      message: `${session.name} requested a warning for ${target.name}.`,
      link: `/warnings`,
      dedupeKey: `warning-approval:${approval.id}`,
    });

    await logActivity({
      organizationId: session.organizationId, userId: session.id, action: "WARNING_APPROVAL_REQUESTED",
      entityType: "warning", entityId: warning.id, metadata: { approverId, targetUserId: target.id },
    });

    return NextResponse.json({ warning, approval, requiresApproval: true }, { status: 201 });
  }

  await createNotification({
    organizationId: session.organizationId,
    userId: target.id,
    type: input.type === "ESCALATION" ? "ESCALATION" : "WARNING",
    title: "OPDesk warning",
    message: input.reason,
    link: `/warnings`,
    dedupeKey: `warning:${warning.id}`,
  });
  await logActivity({
    organizationId: session.organizationId, userId: session.id, action: "WARNING_ISSUED",
    entityType: "warning", entityId: warning.id, metadata: { targetUserId: target.id, type: input.type },
  });

  return NextResponse.json({ warning, requiresApproval: false }, { status: 201 });
}
