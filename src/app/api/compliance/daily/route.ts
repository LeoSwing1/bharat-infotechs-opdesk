import { NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { db } from "@/db";
import { attendance, dailyUpdates, users } from "@/db/schema";
import { createNotification } from "@/services/notifications/notification.service";

function istDate() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!db) return NextResponse.json({ available: false, people: [] });

  const canView = session.role === "SUPER_ADMIN" || session.role === "HR_MANAGER" || session.role === "MANAGER" || session.role === "TEAM_LEAD" || await hasPermission(session, "attendance.view");
  if (!canView) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const today = istDate();
  const active = await db.select({ id: users.id, name: users.name, role: users.role, teamId: users.teamId, managerId: users.reportingManagerId })
    .from(users).where(and(eq(users.organizationId, session.organizationId), eq(users.status, "ACTIVE")));

  let scoped = active;
  if (session.role === "MANAGER") scoped = active.filter(u => u.id === session.id || u.managerId === session.id);
  if (session.role === "TEAM_LEAD") scoped = active.filter(u => u.id === session.id || (u.teamId !== null && u.teamId === session.id));

  const ids = scoped.map(u => u.id);
  const [att, updates] = ids.length ? await Promise.all([
    db.select({ userId: attendance.userId }).from(attendance).where(and(eq(attendance.organizationId, session.organizationId), eq(attendance.attendanceDate, today), inArray(attendance.userId, ids))),
    db.select({ userId: dailyUpdates.userId }).from(dailyUpdates).where(and(eq(dailyUpdates.organizationId, session.organizationId), eq(dailyUpdates.updateDate, today), inArray(dailyUpdates.userId, ids))),
  ]) : [[], []];

  const attIds = new Set(att.map(x => x.userId));
  const updateIds = new Set(updates.map(x => x.userId));
  const people = scoped.map(person => ({ ...person, attendance: attIds.has(person.id) ? "RECORDED" : "MISSING", dailyUpdate: updateIds.has(person.id) ? "SUBMITTED" : "MISSING" }));

  return NextResponse.json({ available: true, date: today, total: people.length, attendanceMissing: people.filter(p => p.attendance === "MISSING").length, dailyUpdatesMissing: people.filter(p => p.dailyUpdate === "MISSING").length, people });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!db) return NextResponse.json({ error: "Database not configured" }, { status: 500 });
  if (session.role !== "SUPER_ADMIN" && session.role !== "HR_MANAGER" && session.role !== "MANAGER") return NextResponse.json({ error: "Only management can trigger compliance reminders" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const kind = body?.kind === "ATTENDANCE" ? "ATTENDANCE" : body?.kind === "DAILY_UPDATE" ? "DAILY_UPDATE" : null;
  if (!kind) return NextResponse.json({ error: "kind must be ATTENDANCE or DAILY_UPDATE" }, { status: 422 });

  const today = istDate();
  const active = await db.select({ id: users.id, name: users.name, reportingManagerId: users.reportingManagerId }).from(users)
    .where(and(eq(users.organizationId, session.organizationId), eq(users.status, "ACTIVE")));
  const scoped = session.role === "MANAGER" ? active.filter(u => u.id === session.id || u.reportingManagerId === session.id) : active;
  const ids = scoped.map(x => x.id);
  if (!ids.length) return NextResponse.json({ sent: 0 });

  const rows = kind === "ATTENDANCE"
    ? await db.select({ userId: attendance.userId }).from(attendance).where(and(eq(attendance.organizationId, session.organizationId), eq(attendance.attendanceDate, today), inArray(attendance.userId, ids)))
    : await db.select({ userId: dailyUpdates.userId }).from(dailyUpdates).where(and(eq(dailyUpdates.organizationId, session.organizationId), eq(dailyUpdates.updateDate, today), inArray(dailyUpdates.userId, ids)));
  const done = new Set(rows.map(x => x.userId));
  let sent = 0;
  for (const person of scoped) {
    if (done.has(person.id)) continue;
    const result = await createNotification({ organizationId: session.organizationId, userId: person.id, type: "COMPLIANCE_REMINDER", title: kind === "ATTENDANCE" ? "Attendance reminder" : "Daily update required", message: kind === "ATTENDANCE" ? "Please clock in for today." : "Please submit your mandatory daily update before the day ends.", link: kind === "ATTENDANCE" ? "/attendance" : "/daily-updates", dedupeKey: `compliance:${kind}:${today}:${person.id}` });
    if (result.status === "CREATED") sent++;
  }
  return NextResponse.json({ sent, date: today, kind });
}
