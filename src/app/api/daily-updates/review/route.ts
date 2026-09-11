import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { db } from "@/db";
import { dailyUpdates, users } from "@/db/schema";
import { createNotification } from "@/services/notifications/notification.service";
import { logActivity } from "@/services/activity/activity.service";

export async function PATCH(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!db) return NextResponse.json({ error: "Database not configured" }, { status: 500 });

  const body = await req.json().catch(() => null);
  const updateId = typeof body?.updateId === "string" ? body.updateId : "";
  const action = body?.action === "REVIEW" ? "REVIEW" : null;
  if (!updateId || !action) return NextResponse.json({ error: "updateId and action=REVIEW are required" }, { status: 422 });

  const allowed = session.role === "SUPER_ADMIN" || await hasPermission(session, "tasks.review");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [update] = await db.select({ update: dailyUpdates, user: users })
    .from(dailyUpdates)
    .innerJoin(users, eq(dailyUpdates.userId, users.id))
    .where(and(eq(dailyUpdates.id, updateId), eq(dailyUpdates.organizationId, session.organizationId)));
  if (!update) return NextResponse.json({ error: "Daily update not found" }, { status: 404 });

  // Managers/TLs may review updates only for people they can already see.
  if (session.role === "MANAGER" && update.user.reportingManagerId !== session.id) {
    return NextResponse.json({ error: "You can only review updates from your direct reports" }, { status: 403 });
  }
  if (session.role === "TEAM_LEAD" && update.user.teamId) {
    // Team-scoped permission is enforced by hasPermission above; keep the route conservative
    // for a lead with no team relationship to the submitter.
    const { canAccessTeam } = await import("@/lib/permissions");
    if (!(await canAccessTeam(session, update.user.teamId, "tasks.review"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [updated] = await db.update(dailyUpdates)
    .set({ status: "REVIEWED", reviewedBy: session.id })
    .where(eq(dailyUpdates.id, updateId)).returning();

  await createNotification({
    organizationId: session.organizationId,
    userId: update.user.id,
    type: "DAILY_UPDATE_REVIEWED",
    title: "Daily update reviewed",
    message: `Your daily update for ${update.update.updateDate} was reviewed by ${session.name}.`,
    link: "/daily-updates",
    dedupeKey: `daily-update-reviewed:${updateId}`,
  });
  await logActivity({ organizationId: session.organizationId, userId: session.id, action: "DAILY_UPDATE_REVIEWED", entityType: "daily_update", entityId: updateId });

  return NextResponse.json({ update: updated });
}
