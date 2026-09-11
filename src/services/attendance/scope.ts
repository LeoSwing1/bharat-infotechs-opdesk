import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users, teams, teamMembers } from "@/db/schema";
import { canAccessTeam } from "@/lib/permissions";
import type { SessionUser } from "@/lib/auth";

export class ScopeForbiddenError extends Error {}

/**
 * Resolves which users' records the requester is allowed to see for a
 * given scopable permission (e.g. "attendance.view"), given optional
 * userId/teamId filters:
 *  - Super Admin / HR: org-wide by default, or a specific user/team if requested.
 *  - Team Lead: their own team(s) by default; a specific person only if
 *    that person is on a team the Team Lead actually has authority over.
 *  - Everyone else: themselves only, regardless of what was requested.
 */
export async function resolveAttendanceScope(
  session: SessionUser,
  requestedUserId?: string,
  requestedTeamId?: string,
  permissionKey: string = "attendance.view"
): Promise<{ userId?: string; userIds?: string[] }> {
  if (session.role === "SUPER_ADMIN" || session.role === "HR_MANAGER") {
    if (requestedUserId) return { userId: requestedUserId };
    if (requestedTeamId) {
      const members = db ? await db.selectDistinct({ userId: teamMembers.userId }).from(teamMembers).where(eq(teamMembers.teamId, requestedTeamId)) : [];
      return { userIds: members.map(m => m.userId) };
    }
    return {};
  }

  if (session.role === "MANAGER") {
    if (requestedUserId && requestedUserId !== session.id) {
      const [target] = db ? await db.select({ reportingManagerId: users.reportingManagerId }).from(users).where(eq(users.id, requestedUserId)) : [];
      if (target?.reportingManagerId !== session.id) throw new ScopeForbiddenError();
      return { userId: requestedUserId };
    }
    const reports = db ? await db.select({ id: users.id }).from(users).where(eq(users.reportingManagerId, session.id)) : [];
    return { userIds: Array.from(new Set([session.id, ...reports.map(r => r.id)])) };
  }

  if (session.role === "TEAM_LEAD") {
    if (requestedUserId && requestedUserId !== session.id) {
      const [target] = db ? await db.select({ teamId: users.teamId }).from(users).where(eq(users.id, requestedUserId)) : [];
      if (!target?.teamId || !(await canAccessTeam(session, target.teamId, permissionKey))) {
        throw new ScopeForbiddenError();
      }
      return { userId: requestedUserId };
    }
    const ownedTeams = db ? await db.select({ id: teams.id }).from(teams).where(eq(teams.leadUserId, session.id)) : [];
    const teamIds = ownedTeams.map(t => t.id);
    if (teamIds.length === 0) return { userIds: [session.id] };
    const allMembers: string[] = [session.id];
    for (const tid of teamIds) {
      const members = db ? await db.selectDistinct({ userId: teamMembers.userId }).from(teamMembers).where(eq(teamMembers.teamId, tid)) : [];
      allMembers.push(...members.map(m => m.userId));
    }
    return { userIds: Array.from(new Set(allMembers)) };
  }

  return { userId: session.id };
}
