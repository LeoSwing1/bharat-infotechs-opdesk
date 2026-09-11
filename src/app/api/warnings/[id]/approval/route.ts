import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { warnings, warningApprovals, users } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { createNotification } from "@/services/notifications/notification.service";
import { logActivity } from "@/services/activity/activity.service";

const requestSchema = z.object({ approverId: z.string().uuid() });
const decisionSchema = z.object({ approvalId: z.string().uuid(), status: z.enum(["APPROVED", "REJECTED"]), comments: z.string().max(2000).optional() });

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!db) return NextResponse.json({ error: "Database not configured" }, { status: 500 });
  if (!(await hasPermission(session, "warnings.request"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const parsed = requestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Validation failed" }, { status: 422 });

  const [warning] = await db.select().from(warnings).where(and(eq(warnings.id, id), eq(warnings.organizationId, session.organizationId)));
  if (!warning) return NextResponse.json({ error: "Warning not found" }, { status: 404 });
  if (parsed.data.approverId === session.id) return NextResponse.json({ error: "The requester cannot approve their own warning" }, { status: 422 });

  const [approver] = await db.select({ id: users.id, role: users.role }).from(users).where(and(
    eq(users.id, parsed.data.approverId), eq(users.organizationId, session.organizationId), eq(users.status, "ACTIVE")
  ));
  if (!approver) return NextResponse.json({ error: "Approver not found" }, { status: 404 });

  const [approval] = await db.insert(warningApprovals).values({
    organizationId: session.organizationId, warningId: id, requestedBy: session.id, approverId: approver.id,
  }).returning();

  await createNotification({
    organizationId: session.organizationId, userId: approver.id, type: "SYSTEM",
    title: "Warning approval requested", message: `A warning request from ${session.name} needs your decision.`,
    link: "/warnings", dedupeKey: `warning-approval:${approval.id}`,
  });
  return NextResponse.json({ approval }, { status: 201 });
}

export async function PATCH(req: Request, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!db) return NextResponse.json({ error: "Database not configured" }, { status: 500 });
  if (!(await hasPermission(session, "warnings.approve"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = decisionSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Validation failed" }, { status: 422 });

  const [approval] = await db.select().from(warningApprovals).where(and(
    eq(warningApprovals.id, body.data.approvalId), eq(warningApprovals.warningId, id),
    eq(warningApprovals.approverId, session.id), eq(warningApprovals.status, "PENDING"),
    eq(warningApprovals.organizationId, session.organizationId)
  ));
  if (!approval) return NextResponse.json({ error: "Approval request not found" }, { status: 404 });

  const [warning] = await db.select().from(warnings).where(and(eq(warnings.id, id), eq(warnings.organizationId, session.organizationId)));
  if (!warning) return NextResponse.json({ error: "Warning not found" }, { status: 404 });

  const [updated] = await db.update(warningApprovals).set({
    status: body.data.status, comments: body.data.comments ?? null, decidedAt: new Date(),
  }).where(eq(warningApprovals.id, approval.id)).returning();

  if (body.data.status === "APPROVED") {
    await createNotification({
      organizationId: session.organizationId, userId: warning.userId, type: warning.type === "ESCALATION" ? "ESCALATION" : "WARNING",
      title: "Warning issued", message: warning.reason, link: "/warnings", dedupeKey: `warning-issued:${warning.id}`,
    });
    await createNotification({
      organizationId: session.organizationId, userId: approval.requestedBy, type: "SYSTEM",
      title: "Warning request approved", message: "Your warning request has been approved.", link: "/warnings",
      dedupeKey: `warning-decision:${approval.id}`,
    });
    await logActivity({ organizationId: session.organizationId, userId: session.id, action: "WARNING_APPROVED", entityType: "warning", entityId: warning.id, metadata: { approvalId: approval.id } });
  } else {
    await db.update(warnings).set({ status: "REJECTED" }).where(eq(warnings.id, warning.id));
    await createNotification({
      organizationId: session.organizationId, userId: approval.requestedBy, type: "SYSTEM",
      title: "Warning request rejected", message: body.data.comments || "The manager rejected the warning request.", link: "/warnings",
      dedupeKey: `warning-decision:${approval.id}`,
    });
    await logActivity({ organizationId: session.organizationId, userId: session.id, action: "WARNING_REJECTED", entityType: "warning", entityId: warning.id, metadata: { approvalId: approval.id, comments: body.data.comments ?? null } });
  }

  return NextResponse.json({ approval: updated });
}
