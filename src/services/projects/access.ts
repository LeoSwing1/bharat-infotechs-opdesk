import { canAccessTeam } from "@/lib/permissions";
import type { SessionUser } from "@/lib/auth";

export type ProjectAccessInfo = { teamId: string | null; managerId: string | null };

export async function canViewProject(session: SessionUser, project: ProjectAccessInfo): Promise<boolean> {
  if (session.role === "SUPER_ADMIN") return true;
  if (project.managerId === session.id) return true;
  if (project.teamId) return canAccessTeam(session, project.teamId, "projects.view");
  return false;
}

export async function canManageProject(session: SessionUser, project: ProjectAccessInfo): Promise<boolean> {
  if (session.role === "SUPER_ADMIN") return true;
  if (project.managerId === session.id) return true;
  if (project.teamId) return canAccessTeam(session, project.teamId, "projects.manage");
  return false;
}
