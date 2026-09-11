import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { db } from "@/db";
import { dailyUpdates, users } from "@/db/schema";
import { createDailyUpdateSchema } from "@/validations/daily-updates";
import { resolveAttendanceScope, ScopeForbiddenError } from "@/services/attendance/scope";
import { logActivity } from "@/services/activity/activity.service";

import { localDateString, localHour } from "@/lib/time";

function todayDateString(): string {
  return localDateString();
}

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (process.env.DEMO_MODE === "true" || !db) return NextResponse.json({ updates: [] });

  const url = new URL(req.url);
  const date = url.searchParams.get("date") ?? undefined;

  // Daily update visibility mirrors task visibility (both are "can this
  // person see this team member's day-to-day work"), avoiding the need for
  // a separate permission category just for this.
  let scope;
  try {
    scope = await resolveAttendanceScope(session, url.searchParams.get("userId") ?? undefined, url.searchParams.get("teamId") ?? undefined, "tasks.view");
  } catch (e) {
    if (e instanceof ScopeForbiddenError) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    throw e;
  }

  const conditions = [eq(dailyUpdates.organizationId, session.organizationId)];
  if (scope.userId) conditions.push(eq(dailyUpdates.userId, scope.userId));
  if (date) conditions.push(eq(dailyUpdates.updateDate, date));

  const rows = await db
    .select({
      id: dailyUpdates.id, userId: dailyUpdates.userId, userName: users.name,
      updateDate: dailyUpdates.updateDate, workedOn: dailyUpdates.workedOn,
      completed: dailyUpdates.completed, nextWork: dailyUpdates.nextWork,
      blockers: dailyUpdates.blockers, status: dailyUpdates.status,
      createdAt: dailyUpdates.createdAt,
    })
    .from(dailyUpdates)
    .innerJoin(users, eq(dailyUpdates.userId, users.id))
    .where(and(...conditions))
    .orderBy(desc(dailyUpdates.updateDate));

  const filtered = scope.userIds ? rows.filter(r => scope.userIds!.includes(r.userId)) : rows;
  return NextResponse.json({ updates: filtered });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (process.env.DEMO_MODE === "true") {
    return NextResponse.json({ error: "Not available in demo mode" }, { status: 400 });
  }
  if (!db) return NextResponse.json({ error: "Database not configured" }, { status: 500 });

  const body = await req.json().catch(() => null);
  const parsed = createDailyUpdateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 422 });
  const input = parsed.data;

  const today = todayDateString();
  const [existing] = await db.select({ id: dailyUpdates.id }).from(dailyUpdates)
    .where(and(eq(dailyUpdates.organizationId, session.organizationId), eq(dailyUpdates.userId, session.id), eq(dailyUpdates.updateDate, today)));

  if (existing) {
    return NextResponse.json({ error: "You've already submitted an update for today. Edit isn't supported yet — contact your manager for corrections." }, { status: 409 });
  }

  const hour = localHour();
  const status = hour >= 19 ? "LATE" : "SUBMITTED"; // after 7 PM counts as late

  const [created] = await db.insert(dailyUpdates).values({
    organizationId: session.organizationId,
    userId: session.id,
    updateDate: today,
    workedOn: input.workedOn,
    completed: input.completed ?? null,
    nextWork: input.nextWork ?? null,
    blockers: input.blockers ?? null,
    projectId: input.projectId ?? null,
    taskId: input.taskId ?? null,
    status,
  }).returning();

  await logActivity({
    organizationId: session.organizationId, userId: session.id, action: "DAILY_UPDATE_SUBMITTED",
    entityType: "daily_update", entityId: created.id,
  });

  return NextResponse.json({ update: created }, { status: 201 });
}
