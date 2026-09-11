export type NotificationType =
  | "TASK_ASSIGNED"
  | "TASK_REMINDER"
  | "TASK_OVERDUE"
  | "TASK_SUBMITTED"
  | "TASK_REVIEWED"
  | "MEETING_INVITE"
  | "MEETING_REMINDER"
  | "MEETING_STARTING"
  | "ATTENDANCE_REMINDER"
  | "DAILY_UPDATE_REMINDER"
  | "CHAT_MESSAGE"
  | "WARNING"
  | "ESCALATION"
  | "SYSTEM";

export type CreateNotificationInput = {
  organizationId: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  dedupeKey?: string;
};