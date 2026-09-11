"use client";
import { Fragment, useEffect, useMemo, useState } from "react";

type PermissionDef = { key: string; label: string; category: string };
type Role = "HR_MANAGER" | "MANAGER" | "TEAM_LEAD" | "EMPLOYEE" | "INTERN_EMPLOYEE";
type SessionUser = { role: string };

const ROLE_LABELS: Record<Role, string> = {
  MANAGER: "Manager",
  HR_MANAGER: "HR Manager",
  TEAM_LEAD: "Team Lead",
  EMPLOYEE: "Employee",
  INTERN_EMPLOYEE: "Intern",
};

export default function PermissionsSettingsPage() {
  const [permissions, setPermissions] = useState<PermissionDef[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [grants, setGrants] = useState<Record<string, Record<string, boolean>>>({});
  const [me, setMe] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [demoMode, setDemoMode] = useState(false);

  async function load() {
    setLoading(true); setError("");
    const [res, meRes] = await Promise.all([fetch("/api/settings/permissions"), fetch("/api/auth/me")]);
    const data = await res.json();
    const meData = await meRes.json();
    if (!res.ok) { setError(data.error ?? "Could not load permissions"); setLoading(false); return; }
    setPermissions(data.permissions ?? []);
    setRoles(data.roles ?? []);
    setGrants(data.grants ?? {});
    setDemoMode(data.source === "defaults");
    setMe(meData.user ?? null);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const categories = useMemo(() => {
    const groups = new Map<string, PermissionDef[]>();
    for (const p of permissions) {
      if (!groups.has(p.category)) groups.set(p.category, []);
      groups.get(p.category)!.push(p);
    }
    return Array.from(groups.entries());
  }, [permissions]);

  const canEdit = me?.role === "SUPER_ADMIN" && !demoMode;

  async function toggle(role: Role, permissionKey: string, current: boolean) {
    const cellKey = `${role}:${permissionKey}`;
    setSavingKey(cellKey);
    setGrants(g => ({ ...g, [role]: { ...g[role], [permissionKey]: !current } }));

    const res = await fetch("/api/settings/permissions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role, permissionKey, granted: !current }),
    });
    setSavingKey(null);

    if (!res.ok) {
      // Revert on failure.
      setGrants(g => ({ ...g, [role]: { ...g[role], [permissionKey]: current } }));
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Roles &amp; Permissions</h1>
        <p className="mt-1 text-gray-500">
          Configure exactly what each role can see and do across OPDesk. Super Admin always has full access.
        </p>
      </div>

      {demoMode && (
        <div className="mb-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
          Showing built-in default permissions. Connect a database to customize and save changes.
        </div>
      )}
      {!canEdit && !demoMode && me && (
        <div className="mb-5 rounded-xl bg-gray-50 p-4 text-sm text-gray-600">
          Only Super Admin can change role permissions. You&apos;re viewing this in read-only mode.
        </div>
      )}
      {error && <div className="card p-8 text-sm text-red-700">{error}</div>}

      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => <div key={i} className="h-10 animate-pulse rounded-xl bg-gray-100" />)}
        </div>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-left">
                <th className="px-5 py-3 font-medium text-gray-500">Permission</th>
                {roles.map(role => (
                  <th key={role} className="px-5 py-3 text-center font-medium text-gray-500">{ROLE_LABELS[role]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {categories.map(([category, perms]) => (
                <Fragment key={category}>
                  <tr className="bg-gray-50/60">
                    <td colSpan={roles.length + 1} className="px-5 py-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                      {category}
                    </td>
                  </tr>
                  {perms.map(p => (
                    <tr key={p.key} className="border-b last:border-0">
                      <td className="px-5 py-3 text-gray-700">{p.label}</td>
                      {roles.map(role => {
                        const checked = grants[role]?.[p.key] ?? false;
                        const cellKey = `${role}:${p.key}`;
                        return (
                          <td key={role} className="px-5 py-3 text-center">
                            <button
                              onClick={() => canEdit && toggle(role, p.key, checked)}
                              disabled={!canEdit || savingKey === cellKey}
                              aria-label={`${p.label} for ${ROLE_LABELS[role]}`}
                              className={`inline-flex h-6 w-11 items-center rounded-full transition disabled:cursor-not-allowed disabled:opacity-60 ${
                                checked ? "bg-gray-900" : "bg-gray-200"
                              } ${canEdit ? "cursor-pointer" : ""}`}
                            >
                              <span className={`h-5 w-5 transform rounded-full bg-white shadow transition ${checked ? "translate-x-5" : "translate-x-0.5"}`} />
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
