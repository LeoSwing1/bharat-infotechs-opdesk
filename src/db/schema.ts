import {
  pgTable, pgEnum, uuid, text, boolean, timestamp, date, time,
  integer, jsonb, uniqueIndex, index
} from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["SUPER_ADMIN","HR_MANAGER","MANAGER","TEAM_LEAD","EMPLOYEE","INTERN_EMPLOYEE"]);
export const statusEnum = pgEnum("user_status", ["ACTIVE","INACTIVE","SUSPENDED"]);
export const taskStatusEnum = pgEnum("task_status", ["ASSIGNED","STARTED","SUBMITTED","UNDER_REVIEW","APPROVED","REJECTED","OVERDUE"]);
export const priorityEnum = pgEnum("priority", ["LOW","MEDIUM","HIGH","URGENT"]);
export const attendanceEnum = pgEnum("attendance_status", ["PRESENT","ABSENT","LATE","EXCUSED"]);
export const meetingStatusEnum = pgEnum("meeting_status", ["SCHEDULED","STARTED","COMPLETED","CANCELLED"]);
export const updateStatusEnum = pgEnum("update_status", ["SUBMITTED","LATE","MISSING","REVIEWED"]);
export const warningTypeEnum = pgEnum("warning_type", ["REMINDER","FIRST_WARNING","SECOND_WARNING","ESCALATION"]);
export const warningStatusEnum = pgEnum("warning_status", ["OPEN","ACKNOWLEDGED","RESOLVED","REJECTED"]);
export const employmentTypeEnum = pgEnum("employment_type", ["EMPLOYEE","INTERN","CONTRACT","FREELANCER","TRAINEE"]);
export const personTypeEnum = pgEnum("person_type", ["EMP","INT"]);
export const attendanceEventEnum = pgEnum("attendance_event_type", ["CLOCK_IN","CLOCK_OUT","BREAK_START","BREAK_END"]);
export const projectStatusEnum = pgEnum("project_status", ["PLANNING","ACTIVE","ON_HOLD","IN_REVIEW","COMPLETED","ARCHIVED"]);
export const projectKindEnum = pgEnum("project_kind", ["INTERNAL","CLIENT"]);
export const assignmentStatusEnum = pgEnum("assignment_status", ["NOT_STARTED","IN_PROGRESS","IN_REVIEW","COMPLETED"]);
export const leaveStatusEnum = pgEnum("leave_status", ["PENDING","APPROVED","REJECTED","CANCELLED"]);
export const leaveTypeEnum = pgEnum("leave_type", ["CASUAL","SICK","ANNUAL","UNPAID","OTHER"]);
export const qualityCategoryEnum = pgEnum("quality_category", ["TASK","ATTENDANCE","COMMUNICATION","DELIVERY","CODE_QUALITY","OVERALL"]);

export const organizations = pgTable("organizations", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});

export const departments = pgTable("departments", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
}, t => [index("dept_org_idx").on(t.organizationId)]);

export const shifts = pgTable("shifts", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  code: text("code").notNull(),
  startTime: time("start_time").notNull(),
  endTime: time("end_time").notNull(),
  gracePeriodMinutes: integer("grace_period_minutes").default(15).notNull(),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, t => [uniqueIndex("shift_org_code_idx").on(t.organizationId, t.code)]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  departmentId: uuid("department_id").references(() => departments.id, { onDelete: "set null" }),
  teamId: uuid("team_id"),
  shiftId: uuid("shift_id").references(() => shifts.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  passwordHash: text("password_hash").notNull(),
  role: roleEnum("role").notNull(),
  status: statusEnum("status").default("ACTIVE").notNull(),
  employeeCode: text("employee_code"),
  employmentType: employmentTypeEnum("employment_type").default("EMPLOYEE").notNull(),
  designation: text("designation"),
  reportingManagerId: uuid("reporting_manager_id"),
  joiningDate: date("joining_date"),
  profileImageUrl: text("profile_image_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
}, t => [
  uniqueIndex("users_org_email_idx").on(t.organizationId, t.email),
  index("users_org_idx").on(t.organizationId),
  uniqueIndex("users_org_employee_code_idx").on(t.organizationId, t.employeeCode),
  index("users_team_idx").on(t.teamId),
  index("users_shift_idx").on(t.shiftId),
  index("users_manager_idx").on(t.reportingManagerId)
]);

export const teams = pgTable("teams", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  departmentId: uuid("department_id").references(() => departments.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  code: text("code").notNull(),
  description: text("description"),
  leadUserId: uuid("lead_user_id").references(() => users.id, { onDelete: "set null" }),
  hrUserId: uuid("hr_user_id").references(() => users.id, { onDelete: "set null" }),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
}, t => [uniqueIndex("team_org_code_idx").on(t.organizationId, t.code)]);

export const teamMembers = pgTable("team_members", {
  id: uuid("id").defaultRandom().primaryKey(),
  teamId: uuid("team_id").notNull().references(() => teams.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
}, t => [uniqueIndex("team_member_unique_idx").on(t.teamId, t.userId)]);

export const projects = pgTable("projects", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  kind: projectKindEnum("kind").default("INTERNAL").notNull(),
  clientName: text("client_name"),
  managerId: uuid("manager_id").references(() => users.id, { onDelete: "set null" }),
  teamId: uuid("team_id").references(() => teams.id, { onDelete: "set null" }),
  status: projectStatusEnum("status").default("PLANNING").notNull(),
  startDate: date("start_date"),
  endDate: date("end_date"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, t => [index("projects_org_idx").on(t.organizationId), index("projects_team_idx").on(t.teamId)]);

export const projectMembers = pgTable("project_members", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  addedAt: timestamp("added_at", { withTimezone: true }).defaultNow().notNull(),
}, t => [uniqueIndex("project_member_unique_idx").on(t.projectId, t.userId)]);

export const assignments = pgTable("assignments", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  ownerId: uuid("owner_id").references(() => users.id, { onDelete: "set null" }),
  teamId: uuid("team_id").references(() => teams.id, { onDelete: "set null" }),
  status: assignmentStatusEnum("status").default("NOT_STARTED").notNull(),
  deadline: timestamp("deadline", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, t => [index("assignments_project_idx").on(t.projectId), index("assignments_org_idx").on(t.organizationId)]);

export const tasks = pgTable("tasks", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
  assignmentId: uuid("assignment_id").references(() => assignments.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  description: text("description"),
  creatorId: uuid("creator_id").notNull().references(() => users.id),
  assigneeId: uuid("assignee_id").references(() => users.id, { onDelete: "set null" }),
  teamId: uuid("team_id").references(() => teams.id, { onDelete: "set null" }),
  status: taskStatusEnum("status").default("ASSIGNED").notNull(),
  priority: priorityEnum("priority").default("MEDIUM").notNull(),
  startAt: timestamp("start_at", { withTimezone: true }),
  deadline: timestamp("deadline", { withTimezone: true }),
  reminderAt: timestamp("reminder_at", { withTimezone: true }),
  recurrence: text("recurrence").default("NONE").notNull(),
  rejectionReason: text("rejection_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
}, t => [
  index("tasks_org_idx").on(t.organizationId),
  index("tasks_deadline_idx").on(t.deadline),
  index("tasks_project_idx").on(t.projectId),
  index("tasks_assignment_idx").on(t.assignmentId),
]);

export const taskComments = pgTable("task_comments", {
  id: uuid("id").defaultRandom().primaryKey(),
  taskId: uuid("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  authorId: uuid("author_id").notNull().references(() => users.id),
  message: text("message").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});

export const taskSubmissions = pgTable("task_submissions", {
  id: uuid("id").defaultRandom().primaryKey(),
  taskId: uuid("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  submittedBy: uuid("submitted_by").notNull().references(() => users.id),
  notes: text("notes"),
  attachmentUrl: text("attachment_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});

export const meetings = pgTable("meetings", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  organizerId: uuid("organizer_id").notNull().references(() => users.id),
  teamId: uuid("team_id").references(() => teams.id, { onDelete: "set null" }),
  startAt: timestamp("start_at", { withTimezone: true }).notNull(),
  endAt: timestamp("end_at", { withTimezone: true }).notNull(),
  meetingLink: text("meeting_link"),
  agenda: text("agenda"),
  notes: text("notes"),
  status: meetingStatusEnum("status").default("SCHEDULED").notNull(),
  googleEventId: text("google_event_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});

export const googleCalendarConnections = pgTable("google_calendar_connections", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  // Encrypted at rest (AES-256-GCM) — see services/integrations/token-crypto.ts.
  // Never returned to any API response; read only server-side to call Google.
  accessTokenEncrypted: text("access_token_encrypted").notNull(),
  refreshTokenEncrypted: text("refresh_token_encrypted").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  scope: text("scope"),
  connectedAt: timestamp("connected_at", { withTimezone: true }).defaultNow().notNull(),
}, t => [uniqueIndex("google_calendar_connection_user_idx").on(t.userId)]);

// A user can have multiple subscriptions (one per browser/device they've
// enabled push on). Deleted automatically when the browser reports the
// subscription as no longer valid (see push.service.ts).
export const pushSubscriptions = pgTable("push_subscriptions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  endpoint: text("endpoint").notNull(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, t => [uniqueIndex("push_subscription_endpoint_idx").on(t.endpoint)]);

export const meetingParticipants = pgTable("meeting_participants", {
  id: uuid("id").defaultRandom().primaryKey(),
  meetingId: uuid("meeting_id").notNull().references(() => meetings.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
}, t => [uniqueIndex("meeting_participant_unique_idx").on(t.meetingId, t.userId)]);

export const attendance = pgTable("attendance", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  attendanceDate: date("attendance_date").notNull(),
  status: attendanceEnum("status").notNull(),
  clockInAt: timestamp("clock_in_at", { withTimezone: true }),
  clockOutAt: timestamp("clock_out_at", { withTimezone: true }),
  breakMinutes: integer("break_minutes").default(0).notNull(),
  workedMinutes: integer("worked_minutes"),
  note: text("note"),
  recordedBy: uuid("recorded_by").references(() => users.id),
  correctedBy: uuid("corrected_by").references(() => users.id),
  correctionReason: text("correction_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
}, t => [uniqueIndex("daily_attendance_unique_idx").on(t.organizationId, t.userId, t.attendanceDate)]);

// Raw clock-in/out/break event log. The `attendance` row above is the daily
// rollup computed from these events (worked minutes, break minutes); this
// table is the source of truth and also doubles as the audit trail for
// "what actually happened and when" that manual corrections can't erase.
export const attendanceEvents = pgTable("attendance_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  attendanceDate: date("attendance_date").notNull(),
  type: attendanceEventEnum("type").notNull(),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).defaultNow().notNull(),
  note: text("note"),
}, t => [
  index("attendance_events_user_date_idx").on(t.userId, t.attendanceDate),
  index("attendance_events_org_idx").on(t.organizationId),
]);

export const meetingAttendance = pgTable("meeting_attendance", {
  id: uuid("id").defaultRandom().primaryKey(),
  meetingId: uuid("meeting_id").notNull().references(() => meetings.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  status: attendanceEnum("status").notNull(),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).defaultNow().notNull()
}, t => [uniqueIndex("meeting_attendance_unique_idx").on(t.meetingId, t.userId)]);

export const dailyUpdates = pgTable("daily_updates", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
  taskId: uuid("task_id").references(() => tasks.id, { onDelete: "set null" }),
  updateDate: date("update_date").notNull(),
  workedOn: text("worked_on").notNull(),
  completed: text("completed"),
  nextWork: text("next_work"),
  blockers: text("blockers"),
  comments: text("comments"),
  status: updateStatusEnum("status").default("SUBMITTED").notNull(),
  reviewedBy: uuid("reviewed_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
}, t => [uniqueIndex("daily_update_unique_idx").on(t.organizationId, t.userId, t.updateDate)]);

export const notifications = pgTable("notifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  link: text("link"),
  readAt: timestamp("read_at", { withTimezone: true }),
  dedupeKey: text("dedupe_key"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
}, t => [index("notifications_user_idx").on(t.userId), uniqueIndex("notifications_dedupe_idx").on(t.userId, t.dedupeKey)]);

export const warnings = pgTable("warnings", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id),
  issuedBy: uuid("issued_by").notNull().references(() => users.id),
  type: warningTypeEnum("type").notNull(),
  reason: text("reason").notNull(),
  relatedEntityType: text("related_entity_type"),
  relatedEntityId: uuid("related_entity_id"),
  notes: text("notes"),
  status: warningStatusEnum("status").default("OPEN").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});

export const leaveRequests = pgTable("leave_requests", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: leaveTypeEnum("type").notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  days: integer("days").notNull(),
  reason: text("reason").notNull(),
  status: leaveStatusEnum("status").default("PENDING").notNull(),
  reviewedBy: uuid("reviewed_by").references(() => users.id, { onDelete: "set null" }),
  reviewNote: text("review_note"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
}, t => [index("leave_org_idx").on(t.organizationId), index("leave_user_idx").on(t.userId), index("leave_status_idx").on(t.status)]);

export const qualityScores = pgTable("quality_scores", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  scoredBy: uuid("scored_by").notNull().references(() => users.id),
  category: qualityCategoryEnum("category").notNull(),
  score: integer("score").notNull(),
  period: text("period").notNull(),
  comment: text("comment"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
}, t => [index("quality_org_user_idx").on(t.organizationId, t.userId), index("quality_period_idx").on(t.period)]);

export const automationRuns = pgTable("automation_runs", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  rule: text("rule").notNull(),
  dedupeKey: text("dedupe_key").notNull(),
  executedAt: timestamp("executed_at", { withTimezone: true }).defaultNow().notNull()
}, t => [uniqueIndex("automation_rule_dedupe_idx").on(t.organizationId, t.rule, t.dedupeKey)]);

export const emailLogs = pgTable("email_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").references(() => organizations.id, { onDelete: "set null" }),
  to: text("to").notNull(),
  subject: text("subject").notNull(),
  type: text("type").notNull(),
  status: text("status").notNull(),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});

export const activityLogs = pgTable("activity_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  entityType: text("entity_type"),
  entityId: uuid("entity_id"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
}, t => [index("activity_org_idx").on(t.organizationId, t.createdAt)]);

export const idSequences = pgTable("id_sequences", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  personType: personTypeEnum("person_type").notNull(),
  year: integer("year").notNull(),
  lastNumber: integer("last_number").default(0).notNull()
}, t => [uniqueIndex("id_seq_org_type_year_idx").on(t.organizationId, t.personType, t.year)]);

export const permissions = pgTable("permissions", {
  key: text("key").primaryKey(),
  label: text("label").notNull(),
  category: text("category").notNull()
});

export const rolePermissions = pgTable("role_permissions", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  role: roleEnum("role").notNull(),
  permissionKey: text("permission_key").notNull().references(() => permissions.key, { onDelete: "cascade" }),
  granted: boolean("granted").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
}, t => [uniqueIndex("role_perm_unique_idx").on(t.organizationId, t.role, t.permissionKey)]);

// Scoped grants: e.g. Super Admin gives a Team Lead an extra authority
// (or an HR rep an authority) for one specific team only.
export const teamAuthorities = pgTable("team_authorities", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  teamId: uuid("team_id").notNull().references(() => teams.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  permissionKey: text("permission_key").notNull().references(() => permissions.key, { onDelete: "cascade" }),
  grantedBy: uuid("granted_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
}, t => [
  uniqueIndex("team_authority_unique_idx").on(t.teamId, t.userId, t.permissionKey),
  index("team_authority_org_idx").on(t.organizationId)
]);

export const settings = pgTable("settings", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  key: text("key").notNull(),
  value: text("value"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
}, t => [uniqueIndex("settings_org_key_idx").on(t.organizationId, t.key)]);


export const conversationTypeEnum = pgEnum("conversation_type", ["DIRECT", "GROUP", "SPACE"]);
export const messageTypeEnum = pgEnum("message_type", ["TEXT", "SYSTEM", "FILE"]);
export const approvalStatusEnum = pgEnum("approval_status", ["PENDING", "APPROVED", "REJECTED", "CANCELLED"]);

export const conversations = pgTable("conversations", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  type: conversationTypeEnum("type").notNull(),
  name: text("name"),
  description: text("description"),
  createdBy: uuid("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, t => [index("conversation_org_idx").on(t.organizationId)]);

export const conversationMembers = pgTable("conversation_members", {
  id: uuid("id").defaultRandom().primaryKey(),
  conversationId: uuid("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: text("role").default("MEMBER").notNull(),
  joinedAt: timestamp("joined_at", { withTimezone: true }).defaultNow().notNull(),
  lastReadAt: timestamp("last_read_at", { withTimezone: true }),
}, t => [uniqueIndex("conversation_member_unique_idx").on(t.conversationId, t.userId)]);

export const messages = pgTable("messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  conversationId: uuid("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  senderId: uuid("sender_id").notNull().references(() => users.id),
  type: messageTypeEnum("type").default("TEXT").notNull(),
  body: text("body").notNull(),
  attachmentUrl: text("attachment_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  editedAt: timestamp("edited_at", { withTimezone: true }),
}, t => [index("message_conversation_idx").on(t.conversationId, t.createdAt)]);

export const warningApprovals = pgTable("warning_approvals", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  warningId: uuid("warning_id").notNull().references(() => warnings.id, { onDelete: "cascade" }),
  requestedBy: uuid("requested_by").notNull().references(() => users.id),
  approverId: uuid("approver_id").notNull().references(() => users.id),
  status: approvalStatusEnum("status").default("PENDING").notNull(),
  comments: text("comments"),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, t => [index("warning_approval_org_idx").on(t.organizationId), index("warning_approval_approver_idx").on(t.approverId, t.status)]);
