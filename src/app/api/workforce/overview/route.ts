import { NextResponse } from "next/server";
import { and, eq, inArray, lt, sql } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { db } from "@/db";
import {
  users, teams, teamMembers, tasks, attendance, dailyUpdates,
  warnings, warningApprovals, meetings,
} from "@/db/schema";

const OPEN_TASK_STATUSES = ["ASSIGNED", "STARTED", "SUBMITTED", "UNDER_REVIEW", "REJECTED"] as const;

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!db) return NextResponse.json({ available: false, scope: "demo" });

  const orgId = session.organizationId;
  const today = new Date().toISOString().slice(0, 10);
  const now = new Date();

  let userIds: string[] = [session.id];
  let teamIds: string[] = [];
  let scope: "organization" | "team" | "personal" = "personal";

  if (session.role === "SUPER_ADMIN" || session.role === "HR_MANAGER") {
    scope = "organization";
    const people = await db.select({ id: users.id }).from(users).where(eq(users.organizationId, orgId));
    userIds = people.map(p => p.id);
    const teamsRows = await db.select({ id: teams.id }).from(teams).where(and(eq(teams.organizationId, orgId), eq(teams.active, true)));
    teamIds = teamsRows.map(t => t.id);
  } else if (session.role === "MANAGER") {
    scope = "team";
    const reports = await db.select({ id: users.id }).from(users).where(and(eq(users.organizationId, orgId), eq(users.reportingManagerId, session.id), eq(users.status, "ACTIVE")));
    userIds = Array.from(new Set([session.id, ...reports.map(r => r.id)]));
  } else if (session.role === "TEAM_LEAD") {
    scope = "team";
    const owned = await db.select({ id: teams.id }).from(teams).where(and(eq(teams.organizationId, orgId), eq(teams.leadUserId, session.id), eq(teams.active, true)));
    teamIds = owned.map(t => t.id);
    if (teamIds.length) {
      const members = await db.select({ userId: teamMembers.userId }).from(teamMembers).where(inArray(teamMembers.teamId, teamIds));
      userIds = Array.from(new Set([session.id, ...members.map(m => m.userId)]));
    }
  }

  const userFilter = userIds.length ? inArray(users.id, userIds) : eq(users.id, session.id);
  const taskFilter = userIds.length ? inArray(tasks.assigneeId, userIds) : eq(tasks.assigneeId, session.id);

  const [activePeople, openTasks, overdueTasks, todayAttendance, todayUpdates, openWarnings, pendingApprovals, upcomingMeetings] = await Promise.all([
    db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(users).where(and(eq(users.organizationId, orgId), userFilter, eq(users.status, "ACTIVE"))),
    db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(tasks).where(and(eq(tasks.organizationId, orgId), taskFilter, inArray(tasks.status, OPEN_TASK_STATUSES))),
    db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(tasks).where(and(eq(tasks.organizationId, orgId), taskFilter, lt(tasks.deadline, now), inArray(tasks.status, OPEN_TASK_STATUSES))),
    db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(attendance).where(and(eq(attendance.organizationId, orgId), inArray(attendance.userId, userIds), eq(attendance.attendanceDate, today))),
    db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(dailyUpdates).where(and(eq(dailyUpdates.organizationId, orgId), inArray(dailyUpdates.userId, userIds), eq(dailyUpdates.updateDate, today))),
    db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(warnings).where(and(eq(warnings.organizationId, orgId), inArray(warnings.userId, userIds), inArray(warnings.status, ["OPEN", "ACKNOWLEDGED"]))),
    db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(warningApprovals).where(and(eq(warningApprovals.organizationId, orgId), eq(warningApprovals.approverId, session.id), eq(warningApprovals.status, "PENDING"))),
    db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(meetings).where(and(eq(meetings.organizationId, orgId), sql`${meetings.startAt} >= ${now}`, sql`${meetings.startAt} < ${new Date(now.getTime() + 24 * 60 * 60 * 1000)}`)),
  ]);

  const activeCount = activePeople[0]?.count ?? 0;
  const updateCount = todayUpdates[0]?.count ?? 0;
  const attendanceCount = todayAttendance[0]?.count ?? 0;

  return NextResponse.json({
    available: true,
    scope,
    today,
    activePeople: activeCount,
    attendanceRecorded: attendanceCount,
    attendanceMissing: Math.max(0, activeCount - attendanceCount),
    dailyUpdatesSubmitted: updateCount,
    dailyUpdatesMissing: Math.max(0, activeCount - updateCount),
    openTasks: openTasks[0]?.count ?? 0,
    overdueTasks: overdueTasks[0]?.count ?? 0,
    openWarnings: openWarnings[0]?.count ?? 0,
    pendingApprovals: pendingApprovals[0]?.count ?? 0,
    upcomingMeetings: upcomingMeetings[0]?.count ?? 0,
    teamCount: teamIds.length,
  });
}
