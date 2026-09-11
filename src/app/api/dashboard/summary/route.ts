import { NextResponse } from "next/server";
import { and, eq, inArray, lt, sql } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { db } from "@/db";
import { users, teams, tasks, teamMembers } from "@/db/schema";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (process.env.DEMO_MODE === "true" || !db) {
    // Demo mode has no real aggregate data to compute from — say so rather
    // than inventing numbers.
    return NextResponse.json({ scope: "demo", available: false });
  }

  const orgId = session.organizationId;
  const now = new Date();

  if (session.role === "SUPER_ADMIN" || session.role === "HR_MANAGER") {
    const [[peopleRow], [activeRow], [teamsRow], [taskRow], [overdueRow]] = await Promise.all([
      db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(users).where(eq(users.organizationId, orgId)),
      db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(users).where(and(eq(users.organizationId, orgId), eq(users.status, "ACTIVE"))),
      db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(teams).where(and(eq(teams.organizationId, orgId), eq(teams.active, true))),
      db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(tasks).where(eq(tasks.organizationId, orgId)),
      db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(tasks).where(and(
        eq(tasks.organizationId, orgId),
        lt(tasks.deadline, now),
        inArray(tasks.status, ["ASSIGNED", "STARTED", "SUBMITTED", "UNDER_REVIEW", "REJECTED"])
      )),
    ]);

    const statusCounts = await db
      .select({ status: tasks.status, count: sql<number>`count(*)`.mapWith(Number) })
      .from(tasks)
      .where(eq(tasks.organizationId, orgId))
      .groupBy(tasks.status);

    return NextResponse.json({
      scope: "organization",
      available: true,
      totalPeople: peopleRow.count,
      activePeople: activeRow.count,
      activeTeams: teamsRow.count,
      totalTasks: taskRow.count,
      overdueTasks: overdueRow.count,
      tasksByStatus: Object.fromEntries(statusCounts.map(r => [r.status, r.count])),
    });
  }

  if (session.role === "MANAGER") {
    const reports = await db.select({ id: users.id }).from(users).where(and(eq(users.organizationId, orgId), eq(users.reportingManagerId, session.id)));
    const ids = Array.from(new Set([session.id, ...reports.map(r => r.id)]));
    const [[memberRow], [taskRow], [overdueRow]] = await Promise.all([
      db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(users).where(and(eq(users.organizationId, orgId), inArray(users.id, ids))),
      db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(tasks).where(and(eq(tasks.organizationId, orgId), inArray(tasks.assigneeId, ids))),
      db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(tasks).where(and(eq(tasks.organizationId, orgId), inArray(tasks.assigneeId, ids), lt(tasks.deadline, now), inArray(tasks.status, ["ASSIGNED", "STARTED", "SUBMITTED", "UNDER_REVIEW", "REJECTED"]))),
    ]);
    return NextResponse.json({ scope: "management", available: true, teamMembers: memberRow.count, totalTasks: taskRow.count, overdueTasks: overdueRow.count, tasksByStatus: {} });
  }

  if (session.role === "TEAM_LEAD") {
    const ownedTeams = await db
      .select({ id: teams.id })
      .from(teams)
      .where(and(eq(teams.organizationId, orgId), eq(teams.leadUserId, session.id)));

    const teamIds = ownedTeams.map(t => t.id);
    if (teamIds.length === 0) {
      return NextResponse.json({ scope: "team", available: true, teamMembers: 0, totalTasks: 0, overdueTasks: 0, tasksByStatus: {} });
    }

    const [[memberRow], [taskRow], [overdueRow]] = await Promise.all([
      db.select({ count: sql<number>`count(distinct ${teamMembers.userId})`.mapWith(Number) }).from(teamMembers).where(inArray(teamMembers.teamId, teamIds)),
      db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(tasks).where(inArray(tasks.teamId, teamIds)),
      db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(tasks).where(and(
        inArray(tasks.teamId, teamIds),
        lt(tasks.deadline, now),
        inArray(tasks.status, ["ASSIGNED", "STARTED", "SUBMITTED", "UNDER_REVIEW", "REJECTED"])
      )),
    ]);

    const statusCounts = await db
      .select({ status: tasks.status, count: sql<number>`count(*)`.mapWith(Number) })
      .from(tasks)
      .where(inArray(tasks.teamId, teamIds))
      .groupBy(tasks.status);

    return NextResponse.json({
      scope: "team",
      available: true,
      teamMembers: memberRow.count,
      totalTasks: taskRow.count,
      overdueTasks: overdueRow.count,
      tasksByStatus: Object.fromEntries(statusCounts.map(r => [r.status, r.count])),
    });
  }

  // INTERN_EMPLOYEE and any other non-management role: personal scope only.
  const [[myTaskRow], [myOverdueRow]] = await Promise.all([
    db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(tasks).where(eq(tasks.assigneeId, session.id)),
    db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(tasks).where(and(
      eq(tasks.assigneeId, session.id),
      lt(tasks.deadline, now),
      inArray(tasks.status, ["ASSIGNED", "STARTED", "SUBMITTED", "UNDER_REVIEW", "REJECTED"])
    )),
  ]);

  const statusCounts = await db
    .select({ status: tasks.status, count: sql<number>`count(*)`.mapWith(Number) })
    .from(tasks)
    .where(eq(tasks.assigneeId, session.id))
    .groupBy(tasks.status);

  return NextResponse.json({
    scope: "personal",
    available: true,
    myTasks: myTaskRow.count,
    myOverdueTasks: myOverdueRow.count,
    tasksByStatus: Object.fromEntries(statusCounts.map(r => [r.status, r.count])),
  });
}
