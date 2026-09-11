import "server-only";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { rolePermissions, teamAuthorities, teams } from "@/db/schema";
import { DEFAULT_ROLE_PERMISSIONS } from "@/lib/permission-catalog";
import type { SessionUser } from "@/lib/auth";

export const roles = ["SUPER_ADMIN", "HR_MANAGER", "MANAGER", "TEAM_LEAD", "EMPLOYEE", "INTERN_EMPLOYEE"] as const;
export type Role = (typeof roles)[number];

type ConfigurableRole = "HR_MANAGER" | "MANAGER" | "TEAM_LEAD" | "EMPLOYEE" | "INTERN_EMPLOYEE";

/**
 * Quick, role-only checks with no DB round-trip. Safe for nav visibility /
 * optimistic UI, but NEVER a substitute for server-side authorization —
 * every API route must still call hasPermission()/canAccessTeam().
 */
export function canManagePeople(role: string) { return role === "SUPER_ADMIN" || role === "HR_MANAGER"; }
export function canManageTeams(role: string) { return role === "SUPER_ADMIN" || role === "HR_MANAGER" || role === "MANAGER" || role === "TEAM_LEAD"; }
export function canReviewTasks(role: string) { return role === "SUPER_ADMIN" || role === "HR_MANAGER" || role === "MANAGER" || role === "TEAM_LEAD"; }
export function isManagement(role: string) { return role !== "INTERN_EMPLOYEE" && role !== "EMPLOYEE"; }

const roleCache = new Map<string, Set<string>>();

/**
 * Resolves the effective set of permission keys for a role within an
 * organization: DB-configured overrides (role_permissions) if any exist,
 * otherwise the built-in defaults. SUPER_ADMIN is not stored — it always
 * has every permission.
 */
export async function getRolePermissions(organizationId: string, role: string): Promise<Set<string>> {
  if (role === "SUPER_ADMIN") return new Set(["*"]);

  const cacheKey = `${organizationId}:${role}`;
  if (roleCache.has(cacheKey)) return roleCache.get(cacheKey)!;

  let keys: string[];

  if (!db) {
    // Demo mode / no database configured — fall back to defaults.
    keys = DEFAULT_ROLE_PERMISSIONS[role as ConfigurableRole] ?? [];
  } else {
    const rows = await db
      .select({ permissionKey: rolePermissions.permissionKey, granted: rolePermissions.granted })
      .from(rolePermissions)
      .where(and(eq(rolePermissions.organizationId, organizationId), eq(rolePermissions.role, role as Role)));

    if (rows.length === 0) {
      keys = DEFAULT_ROLE_PERMISSIONS[role as ConfigurableRole] ?? [];
    } else {
      keys = rows.filter(r => r.granted).map(r => r.permissionKey);
    }
  }

  const set = new Set(keys);
  roleCache.set(cacheKey, set);
  return set;
}

/** Call after any role_permissions write so stale grants aren't served. */
export function invalidateRolePermissionCache(organizationId: string, role?: string) {
  if (role) { roleCache.delete(`${organizationId}:${role}`); return; }
  for (const key of roleCache.keys()) {
    if (key.startsWith(`${organizationId}:`)) roleCache.delete(key);
  }
}

/**
 * Org-wide (non-scoped) permission check. Use this for actions that aren't
 * tied to a specific team, e.g. creating a team or viewing org-wide reports.
 */
export async function hasPermission(session: SessionUser, permissionKey: string): Promise<boolean> {
  if (session.role === "SUPER_ADMIN") return true;
  const granted = await getRolePermissions(session.organizationId, session.role);
  return granted.has(permissionKey);
}

/**
 * Scoped permission check for a specific team. A user has access if:
 *  - they are SUPER_ADMIN,
 *  - their role holds the permission AND they are the team's lead/HR or a member,
 *  - or they hold an explicit team_authorities grant for that exact team.
 */
export async function canAccessTeam(session: SessionUser, teamId: string, permissionKey: string): Promise<boolean> {
  if (session.role === "SUPER_ADMIN") return true;

  const rolePerms = await getRolePermissions(session.organizationId, session.role);
  const roleHasPermission = rolePerms.has(permissionKey);

  if (!db) {
    // Demo mode: HR has org-wide visibility; TL/intern limited to the demo team.
    if (session.role === "HR_MANAGER" || session.role === "MANAGER") return roleHasPermission;
    return roleHasPermission && teamId === "team-102";
  }

  // HR_MANAGER defaults to organization-wide scope for HR-relevant permissions.
  if ((session.role === "HR_MANAGER" || session.role === "MANAGER") && roleHasPermission) return true;

  const [team] = await db
    .select({ leadUserId: teams.leadUserId, hrUserId: teams.hrUserId, organizationId: teams.organizationId })
    .from(teams)
    .where(eq(teams.id, teamId));

  if (!team || team.organizationId !== session.organizationId) return false;

  const isTeamOwner = team.leadUserId === session.id || team.hrUserId === session.id;
  if (roleHasPermission && isTeamOwner) return true;

  const [grant] = await db
    .select({ id: teamAuthorities.id })
    .from(teamAuthorities)
    .where(and(
      eq(teamAuthorities.teamId, teamId),
      eq(teamAuthorities.userId, session.id),
      eq(teamAuthorities.permissionKey, permissionKey)
    ));

  return Boolean(grant);
}
