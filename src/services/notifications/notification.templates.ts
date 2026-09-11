import type { NotificationType } from "./notification.types";

export type NotificationTemplate = {
  type: NotificationType;
  title: string;
  message: string;
};

export function getNotificationTemplate(
  type: NotificationType
): NotificationTemplate {
  switch (type) {
    case "TASK_ASSIGNED":
      return {
        type,
        title: "New task assigned",
        message: "A new task has been assigned to you.",
      };

    case "TASK_REMINDER":
      return {
        type,
        title: "Task reminder",
        message: "You have a pending task that needs your attention.",
      };

    case "TASK_OVERDUE":
      return {
        type,
        title: "Task overdue",
        message: "One of your assigned tasks is overdue.",
      };

    case "TASK_SUBMITTED":
      return {
        type,
        title: "Task submitted",
        message: "A task has been submitted for review.",
      };

    case "TASK_REVIEWED":
      return {
        type,
        title: "Task reviewed",
        message: "One of your tasks has been reviewed.",
      };

    case "MEETING_INVITE":
      return {
        type,
        title: "Meeting invitation",
        message: "You have been invited to a meeting.",
      };

    case "MEETING_REMINDER":
      return {
        type,
        title: "Meeting reminder",
        message: "You have an upcoming meeting.",
      };

    case "MEETING_STARTING":
      return {
        type,
        title: "Meeting starting soon",
        message: "Your meeting is starting soon.",
      };

    case "ATTENDANCE_REMINDER":
      return {
        type,
        title: "Attendance reminder",
        message: "Please make sure your attendance is recorded.",
      };

    case "DAILY_UPDATE_REMINDER":
      return {
        type,
        title: "Daily update reminder",
        message: "Please submit your daily work update.",
      };

    case "WARNING":
      return {
        type,
        title: "OPDesk warning",
        message: "You have received a warning.",
      };

    case "ESCALATION":
      return {
        type,
        title: "OPDesk escalation",
        message: "An issue has been escalated for review.",
      };

    case "SYSTEM":
      return {
        type,
        title: "OPDesk notification",
        message: "You have a new system notification.",
      };
  }
}