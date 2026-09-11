import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { hasPermission, invalidateRolePermissionCache } from "@/lib/permissions";
import { db } from "@/db";
import { rolePermissions } from "@/db/schema";
import { PERMISSIONS, DEFAULT_ROLE_PERMISSIONS } from "@/lib/permission-catalog";
import { updateRolePermissionSchema } from "@/validations/settings";
import { logActivity } from "@/services/activity/activity.service";

const CONFIGURABLE_ROLES = ["HR_MANAGER", "MANAGER", "TEAM_LEAD", "EMPLOYEE", "INTERN_EMPLOYEE"] as const;

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const allowed = session.role === "SUPER_ADMIN" || (await hasPermission(session, "admin.manage_permissions"));
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Build the effective grant matrix: DB overrides where they exist, otherwise defaults.
  const grants: Record<string, Record<string, boolean>> = {};
  for (const role of CONFIGURABLE_ROLES) grants[role] = {};

  if (process.env.DEMO_MODE === "true" || !db) {
    for (const role of CONFIGURABLE_ROLES) {
      const defaults = new Set(DEFAULT_ROLE_PERMISSIONS[role]);
      for (const p of PERMISSIONS) grants[role][p.key] = defaults.has(p.key);
    }
    return NextResponse.json({ permissions: PERMISSIONS, roles: CONFIGURABLE_ROLES, grants, source: "defaults" });
  }

  for (const role of CONFIGURABLE_ROLES) {
    const rows = await db
      .select({ permissionKey: rolePermissions.permissionKey, granted: rolePermissions.granted })
      .from(rolePermissions)
      .where(and(eq(rolePermissions.organizationId, session.organizationId), eq(rolePermissions.role, role)));

    if (rows.length === 0) {
      const defaults = new Set(DEFAULT_ROLE_PERMISSIONS[role]);
      for (const p of PERMISSIONS) grants[role][p.key] = defaults.has(p.key);
    } else {
      const rowMap = new Map(rows.map(r => [r.permissionKey, r.granted]));
      for (const p of PERMISSIONS) grants[role][p.key] = rowMap.get(p.key) ?? false;
    }
  }

  return NextResponse.json({ permissions: PERMISSIONS, roles: CONFIGURABLE_ROLES, grants });
}

export async function PATCH(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Only Super Admin (or an explicitly delegated admin.manage_permissions holder)
  // may reconfigure what other roles can do — this is the authority-of-authorities action.
  const allowed = session.role === "SUPER_ADMIN" || (await hasPermission(session, "admin.manage_permissions"));
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (process.env.DEMO_MODE === "true") {
    return NextResponse.json({ error: "Editing permissions is disabled in demo mode. Connect a database to enable this." }, { status: 400 });
  }
  if (!db) return NextResponse.json({ error: "Database not configured" }, { status: 500 });

  const body = await req.json().catch(() => null);
  const parsed = updateRolePermissionSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 422 });

  const { role, permissionKey, granted } = parsed.data;
  if (!PERMISSIONS.some(p => p.key === permissionKey)) {
    return NextResponse.json({ error: "Unknown permission key" }, { status: 422 });
  }

  const [existing] = await db
    .select({ id: rolePermissions.id })
    .from(rolePermissions)
    .where(and(
      eq(rolePermissions.organizationId, session.organizationId),
      eq(rolePermissions.role, role),
      eq(rolePermissions.permissionKey, permissionKey)
    ));

  if (existing) {
    await db.update(rolePermissions).set({ granted }).where(eq(rolePermissions.id, existing.id));
  } else {
    // First customization for this role: materialize the full default set first,
    // so the role doesn't silently lose its other implicit defaults once one
    // row exists (getRolePermissions treats "any rows present" as authoritative).
    const defaults = DEFAULT_ROLE_PERMISSIONS[role];
    const rowsToInsert = PERMISSIONS.map(p => ({
      organizationId: session.organizationId,
      role,
      permissionKey: p.key,
      granted: p.key === permissionKey ? granted : defaults.includes(p.key),
    }));
    await db.insert(rolePermissions).values(rowsToInsert).onConflictDoNothing();
  }

  invalidateRolePermissionCache(session.organizationId, role);

  await logActivity({
    organizationId: session.organizationId,
    userId: session.id,
    action: "ROLE_PERMISSION_CHANGED",
    entityType: "role_permissions",
    metadata: { role, permissionKey, granted },
  });

  return NextResponse.json({ ok: true });
}
