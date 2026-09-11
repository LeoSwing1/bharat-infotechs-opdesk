import { NextResponse } from "next/server";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { db } from "@/db";
import { users, teams, departments, attendance, attendanceEvents, tasks, dailyUpdates, leaveRequests, warnings, qualityScores, meetings, activityLogs } from "@/db/schema";

async function canSee(session: Awaited<ReturnType<typeof getSession>>, targetId: string) {
  if (!session || !db) return false;
  if (session.role === "SUPER_ADMIN" || session.role === "HR_MANAGER") return true;
  if (session.id === targetId) return true;
  if (session.role === "MANAGER") {
    const [u] = await db.select({ id: users.id }).from(users).where(and(eq(users.id, targetId), eq(users.organizationId, session.organizationId), eq(users.reportingManagerId, session.id)));
    return Boolean(u);
  }
  if (session.role === "TEAM_LEAD") {
    const [u] = await db.select({ id: users.id }).from(users).where(and(eq(users.id, targetId), eq(users.organizationId, session.organizationId)));
    if (!u) return false;
    const teamsOwned = await db.select({ id: teams.id }).from(teams).where(and(eq(teams.organizationId, session.organizationId), eq(teams.leadUserId, session.id), eq(teams.active, true)));
    if (!teamsOwned.length) return false;
    const teamIds = teamsOwned.map(t => t.id);
    const [member] = await db.select({ id: users.id }).from(users).where(and(eq(users.id, targetId), inArray(users.teamId, teamIds)));
    return Boolean(member);
  }
  return false;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!db) return NextResponse.json({ available: false }, { status: 503 });
  const { id } = await params;
  if (!(await canSee(session, id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [person] = await db.select({
    id: users.id, name: users.name, email: users.email, phone: users.phone, role: users.role, status: users.status,
    employeeCode: users.employeeCode, employmentType: users.employmentType, designation: users.designation,
    joiningDate: users.joiningDate, teamId: users.teamId, teamName: teams.name, departmentName: departments.name,
    shiftId: users.shiftId,
  }).from(users)
    .leftJoin(teams, eq(users.teamId, teams.id))
    .leftJoin(departments, eq(users.departmentId, departments.id))
    .where(and(eq(users.id, id), eq(users.organizationId, session.organizationId)));
  if (!person) return NextResponse.json({ error: "Person not found" }, { status: 404 });

  const [todayAttendance, recentEvents, taskRows, updates, leaves, warningRows, qualityRows, meetingRows, activity] = await Promise.all([
    db.select().from(attendance).where(and(eq(attendance.organizationId, session.organizationId), eq(attendance.userId, id))).orderBy(desc(attendance.attendanceDate)).limit(14),
    db.select().from(attendanceEvents).where(and(eq(attendanceEvents.organizationId, session.organizationId), eq(attendanceEvents.userId, id))).orderBy(desc(attendanceEvents.occurredAt)).limit(20),
    db.select({ id: tasks.id, title: tasks.title, status: tasks.status, priority: tasks.priority, deadline: tasks.deadline, updatedAt: tasks.updatedAt })
      .from(tasks).where(and(eq(tasks.organizationId, session.organizationId), eq(tasks.assigneeId, id))).orderBy(desc(tasks.updatedAt)).limit(20),
    db.select().from(dailyUpdates).where(and(eq(dailyUpdates.organizationId, session.organizationId), eq(dailyUpdates.userId, id))).orderBy(desc(dailyUpdates.updateDate)).limit(10),
    db.select().from(leaveRequests).where(and(eq(leaveRequests.organizationId, session.organizationId), eq(leaveRequests.userId, id))).orderBy(desc(leaveRequests.createdAt)).limit(10),
    db.select().from(warnings).where(and(eq(warnings.organizationId, session.organizationId), eq(warnings.userId, id))).orderBy(desc(warnings.createdAt)).limit(10),
    db.select().from(qualityScores).where(and(eq(qualityScores.organizationId, session.organizationId), eq(qualityScores.userId, id))).orderBy(desc(qualityScores.createdAt)).limit(20),
    db.select({ id: meetings.id, title: meetings.title, startAt: meetings.startAt, endAt: meetings.endAt, status: meetings.status })
      .from(meetings).where(and(eq(meetings.organizationId, session.organizationId), sql`${meetings.startAt} >= now() - interval '30 days'`)).orderBy(desc(meetings.startAt)).limit(10),
    db.select().from(activityLogs).where(and(eq(activityLogs.organizationId, session.organizationId), eq(activityLogs.entityId, id))).orderBy(desc(activityLogs.createdAt)).limit(20),
  ]);

  const avgQuality = qualityRows.length ? Math.round(qualityRows.reduce((sum, x) => sum + x.score, 0) / qualityRows.length) : 0;
  const submittedUpdates = updates.length;
  const presentDays = todayAttendance.filter(x => x.status === "PRESENT" || x.status === "LATE").length;
  const overdueTasks = taskRows.filter(x => x.deadline && new Date(x.deadline).getTime() < Date.now() && !["APPROVED"].includes(x.status)).length;

  return NextResponse.json({ available: true, person, metrics: { avgQuality, submittedUpdates, presentDays, overdueTasks, openWarnings: warningRows.filter(x => ["OPEN", "ACKNOWLEDGED"].includes(x.status)).length, pendingLeave: leaves.filter(x => x.status === "PENDING").length }, attendance: todayAttendance, events: recentEvents, tasks: taskRows, dailyUpdates: updates, leave: leaves, warnings: warningRows, quality: qualityRows, meetings: meetingRows, activity });
}
