/**
 * Canonical catalog of OPDesk permissions.
 *
 * Every permission a Super Admin can grant — either as a role default
 * (role_permissions) or as a scoped, per-team authority (team_authorities) —
 * must be declared here first. This keeps the permission system data-driven
 * instead of hardcoded into UI or route logic.
 */
export type PermissionCategory =
  | "people"
  | "teams"
  | "tasks"
  | "projects"
  | "attendance"
  | "quality"
  | "warnings"
  | "leave"
  | "reports"
  | "admin"
  | "communication"
  | "approvals";

export type PermissionDefinition = {
  key: string;
  label: string;
  category: PermissionCategory;
  /** Whether this permission can be granted per-team (scoped), not just org-wide. */
  scopable: boolean;
};

export const PERMISSIONS: PermissionDefinition[] = [
  // People
  { key: "people.view", label: "View people", category: "people", scopable: true },
  { key: "people.create", label: "Create employee/intern", category: "people", scopable: false },
  { key: "people.edit", label: "Edit employee/intern", category: "people", scopable: true },
  { key: "people.deactivate", label: "Deactivate / reactivate people", category: "people", scopable: false },

  // Teams
  { key: "teams.view", label: "View teams", category: "teams", scopable: true },
  { key: "teams.create", label: "Create teams", category: "teams", scopable: false },
  { key: "teams.edit", label: "Edit team details", category: "teams", scopable: true },
  { key: "teams.manage_members", label: "Add / remove team members", category: "teams", scopable: true },
  { key: "teams.assign_authorities", label: "Assign TL / HR / authorities", category: "teams", scopable: false },

  // Tasks
  { key: "tasks.view", label: "View tasks", category: "tasks", scopable: true },
  { key: "tasks.create", label: "Create tasks", category: "tasks", scopable: true },
  { key: "tasks.assign", label: "Assign / reassign tasks", category: "tasks", scopable: true },
  { key: "tasks.review", label: "Review / approve / reject tasks", category: "tasks", scopable: true },

  // Projects
  { key: "projects.view", label: "View projects", category: "projects", scopable: true },
  { key: "projects.manage", label: "Manage projects", category: "projects", scopable: true },

  // Attendance
  { key: "attendance.view", label: "View attendance", category: "attendance", scopable: true },
  { key: "attendance.correct", label: "Correct attendance records", category: "attendance", scopable: true },
  { key: "attendance.manage_shifts", label: "Manage shift schedules", category: "attendance", scopable: false },

  // Quality
  { key: "quality.view", label: "View quality scores", category: "quality", scopable: true },
  { key: "quality.score", label: "Score quality / performance", category: "quality", scopable: true },

  // Warnings
  { key: "warnings.view", label: "View warnings", category: "warnings", scopable: true },
  { key: "warnings.issue", label: "Issue warnings", category: "warnings", scopable: true },

  // Leave
  { key: "leave.view", label: "View leave requests", category: "leave", scopable: true },
  { key: "leave.approve", label: "Approve / reject leave", category: "leave", scopable: true },

  // Reports
  { key: "reports.view_team", label: "View team reports", category: "reports", scopable: true },
  { key: "reports.view_org", label: "View organization-wide reports", category: "reports", scopable: false },

  // Communication
  { key: "chat.view", label: "View chats, groups and spaces", category: "communication", scopable: true },
  { key: "chat.create", label: "Create groups and spaces", category: "communication", scopable: true },
  { key: "chat.manage", label: "Manage chat members", category: "communication", scopable: true },
  { key: "chat.message", label: "Send messages", category: "communication", scopable: true },

  // Approvals
  { key: "warnings.request", label: "Request a warning approval", category: "approvals", scopable: true },
  { key: "warnings.approve", label: "Approve warning requests", category: "approvals", scopable: true },

  // Admin
  { key: "admin.manage_users", label: "Manage users & roles", category: "admin", scopable: false },
  { key: "admin.manage_permissions", label: "Manage roles & permissions", category: "admin", scopable: false },
  { key: "admin.manage_settings", label: "Manage organization settings", category: "admin", scopable: false },
];

export const PERMISSION_KEYS = PERMISSIONS.map(p => p.key);

/**
 * Sensible default role -> permission grants, used to seed a new
 * organization's role_permissions table. Super Admin implicitly has every
 * permission and is never stored in this table.
 */
export const DEFAULT_ROLE_PERMISSIONS: Record<"HR_MANAGER" | "MANAGER" | "TEAM_LEAD" | "EMPLOYEE" | "INTERN_EMPLOYEE", string[]> = {
  MANAGER: [
    "people.view",
    "teams.view",
    "tasks.view", "tasks.create", "tasks.assign", "tasks.review",
    "projects.view", "projects.manage",
    "attendance.view",
    "quality.view", "quality.score",
    "warnings.view", "warnings.request", "warnings.approve",
    "reports.view_team",
    "chat.view", "chat.create", "chat.manage", "chat.message",
  ],
  HR_MANAGER: [
    "people.view", "people.create", "people.edit", "people.deactivate",
    "teams.view",
    "tasks.view",
    "attendance.view", "attendance.correct", "attendance.manage_shifts",
    "warnings.view", "warnings.issue", "warnings.request",
    "leave.view", "leave.approve",
    "reports.view_team",
  ],
  TEAM_LEAD: [
    "people.view",
    "teams.view", "teams.manage_members",
    "tasks.view", "tasks.create", "tasks.assign", "tasks.review",
    "projects.view", "projects.manage",
    "attendance.view",
    "quality.view", "quality.score",
    "warnings.view", "warnings.issue", "warnings.request",
    "leave.view",
    "reports.view_team",
    "chat.view", "chat.create", "chat.manage", "chat.message",
    "warnings.request", "warnings.approve",
  ],
  EMPLOYEE: [
    "people.view", "teams.view", "tasks.view", "tasks.create", "projects.view",
    "attendance.view", "quality.view", "leave.view", "reports.view_team",
    "chat.view", "chat.create", "chat.message", "approvals.view",
  ],
  INTERN_EMPLOYEE: [
    "tasks.view",
    "projects.view",
    "attendance.view",
    "quality.view",
    "leave.view",
    "chat.view", "chat.message",
  ],
};
