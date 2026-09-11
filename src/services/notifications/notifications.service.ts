import "server-only";

import { and, desc, eq, isNull } from "drizzle-orm";

import { db } from "@/db";
import { notifications } from "@/db/schema";

import type {
  CreateNotificationInput,
  NotificationType,
} from "./notification.types";

/**
 * Create a notification for a user.
 *
 * DEMO_MODE:
 * Notifications are logged instead of being written to PostgreSQL.
 *
 * DATABASE MODE:
 * Notifications are persisted in the notifications table.
 */
export async function createNotification(
  input: CreateNotificationInput
) {
  if (process.env.DEMO_MODE === "true") {
    console.log("[OPDesk Notification]", {
      userId: input.userId,
      type: input.type,
      title: input.title,
      message: input.message,
      link: input.link,
      dedupeKey: input.dedupeKey,
    });

    return {
      ok: true,
      status: "DEMO_MODE" as const,
      notification: {
        id: `demo-${Date.now()}`,
        ...input,
        readAt: null,
        createdAt: new Date(),
      },
    };
  }

  if (!db) {
    return {
      ok: false,
      status: "NOT_CONFIGURED" as const,
      notification: null,
    };
  }

  try {
    /*
     * Prevent duplicate notifications.
     *
     * This is particularly important for future automation:
     *
     * task reminder
     * meeting reminder
     * daily update reminder
     * escalation
     *
     * The same automation can run repeatedly without
     * flooding the user with duplicate notifications.
     */
    if (input.dedupeKey) {
      const [existing] = await db
        .select()
        .from(notifications)
        .where(
          and(
            eq(notifications.userId, input.userId),
            eq(notifications.dedupeKey, input.dedupeKey)
          )
        )
        .limit(1);

      if (existing) {
        return {
          ok: true,
          status: "DUPLICATE" as const,
          notification: existing,
        };
      }
    }

    const [notification] = await db
      .insert(notifications)
      .values({
        organizationId: input.organizationId,
        userId: input.userId,
        type: input.type,
        title: input.title,
        message: input.message,
        link: input.link ?? null,
        dedupeKey: input.dedupeKey ?? null,
      })
      .returning();

    return {
      ok: true,
      status: "CREATED" as const,
      notification,
    };
  } catch (error) {
    console.error(
      "[OPDesk Notification] Failed to create notification:",
      error
    );

    return {
      ok: false,
      status: "FAILED" as const,
      notification: null,
      error:
        error instanceof Error
          ? error.message
          : "Unknown notification error",
    };
  }
}

/**
 * Create multiple notifications.
 */
export async function createNotifications(
  inputs: CreateNotificationInput[]
) {
  const results = [];

  for (const input of inputs) {
    const result = await createNotification(input);
    results.push(result);
  }

  return results;
}

/**
 * Get notifications for a user.
 *
 * Only unread notifications can be requested with unreadOnly=true.
 */
export async function getUserNotifications({
  userId,
  limit = 30,
  unreadOnly = false,
}: {
  userId: string;
  limit?: number;
  unreadOnly?: boolean;
}) {
  if (process.env.DEMO_MODE === "true") {
    return [];
  }

  if (!db) {
    return [];
  }

  const conditions = unreadOnly
    ? and(
        eq(notifications.userId, userId),
        isNull(notifications.readAt)
      )
    : eq(notifications.userId, userId);

  return db
    .select()
    .from(notifications)
    .where(conditions)
    .orderBy(desc(notifications.createdAt))
    .limit(Math.min(Math.max(limit, 1), 100));
}

/**
 * Get unread notification count.
 */
export async function getUnreadNotificationCount(
  userId: string
) {
  if (process.env.DEMO_MODE === "true") {
    return 0;
  }

  if (!db) {
    return 0;
  }

  const unread = await db
    .select({
      id: notifications.id,
    })
    .from(notifications)
    .where(
      and(
        eq(notifications.userId, userId),
        isNull(notifications.readAt)
      )
    );

  return unread.length;
}

/**
 * Mark one notification as read.
 */
export async function markNotificationAsRead({
  notificationId,
  userId,
}: {
  notificationId: string;
  userId: string;
}) {
  if (process.env.DEMO_MODE === "true") {
    return {
      ok: true,
      status: "DEMO_MODE" as const,
    };
  }

  if (!db) {
    return {
      ok: false,
      status: "NOT_CONFIGURED" as const,
    };
  }

  const [notification] = await db
    .update(notifications)
    .set({
      readAt: new Date(),
    })
    .where(
      and(
        eq(notifications.id, notificationId),
        eq(notifications.userId, userId)
      )
    )
    .returning();

  if (!notification) {
    return {
      ok: false,
      status: "NOT_FOUND" as const,
    };
  }

  return {
    ok: true,
    status: "READ" as const,
    notification,
  };
}

/**
 * Mark all notifications as read.
 */
export async function markAllNotificationsAsRead(
  userId: string
) {
  if (process.env.DEMO_MODE === "true") {
    return {
      ok: true,
      status: "DEMO_MODE" as const,
    };
  }

  if (!db) {
    return {
      ok: false,
      status: "NOT_CONFIGURED" as const,
    };
  }

  await db
    .update(notifications)
    .set({
      readAt: new Date(),
    })
    .where(
      and(
        eq(notifications.userId, userId),
        isNull(notifications.readAt)
      )
    );

  return {
    ok: true,
    status: "ALL_READ" as const,
  };
}

/**
 * Convenience helpers for common OPDesk notification types.
 */

export async function notifyTaskAssigned({
  organizationId,
  userId,
  taskId,
  taskTitle,
}: {
  organizationId: string;
  userId: string;
  taskId: string;
  taskTitle: string;
}) {
  return createNotification({
    organizationId,
    userId,
    type: "TASK_ASSIGNED",
    title: "New task assigned",
    message: `You have been assigned the task "${taskTitle}".`,
    link: `/tasks/${taskId}`,
    dedupeKey: `task-assigned:${taskId}:${userId}`,
  });
}

export async function notifyTaskReminder({
  organizationId,
  userId,
  taskId,
  taskTitle,
}: {
  organizationId: string;
  userId: string;
  taskId: string;
  taskTitle: string;
}) {
  return createNotification({
    organizationId,
    userId,
    type: "TASK_REMINDER",
    title: "Task reminder",
    message: `Your task "${taskTitle}" is still pending.`,
    link: `/tasks/${taskId}`,
    dedupeKey: `task-reminder:${taskId}:${userId}`,
  });
}

export async function notifyTaskOverdue({
  organizationId,
  userId,
  taskId,
  taskTitle,
}: {
  organizationId: string;
  userId: string;
  taskId: string;
  taskTitle: string;
}) {
  return createNotification({
    organizationId,
    userId,
    type: "TASK_OVERDUE",
    title: "Task overdue",
    message: `The task "${taskTitle}" has passed its deadline.`,
    link: `/tasks/${taskId}`,
    dedupeKey: `task-overdue:${taskId}:${userId}`,
  });
}

export async function notifyMeetingReminder({
  organizationId,
  userId,
  meetingId,
  meetingTitle,
  minutesBefore,
}: {
  organizationId: string;
  userId: string;
  meetingId: string;
  meetingTitle: string;
  minutesBefore: number;
}) {
  return createNotification({
    organizationId,
    userId,
    type:
      minutesBefore <= 15
        ? "MEETING_STARTING"
        : "MEETING_REMINDER",
    title:
      minutesBefore <= 15
        ? "Meeting starting soon"
        : "Meeting reminder",
    message: `"${meetingTitle}" starts in approximately ${minutesBefore} minutes.`,
    link: `/meetings/${meetingId}`,
    dedupeKey: `meeting-reminder:${meetingId}:${userId}:${minutesBefore}`,
  });
}

export async function notifyDailyUpdateReminder({
  organizationId,
  userId,
}: {
  organizationId: string;
  userId: string;
}) {
  return createNotification({
    organizationId,
    userId,
    type: "DAILY_UPDATE_REMINDER",
    title: "Daily update reminder",
    message:
      "Please submit your daily work update in OPDesk.",
    link: "/daily-updates",
    dedupeKey: `daily-update-reminder:${userId}:${new Date()
      .toISOString()
      .slice(0, 10)}`,
  });
}

export async function notifyAttendanceReminder({
  organizationId,
  userId,
}: {
  organizationId: string;
  userId: string;
}) {
  return createNotification({
    organizationId,
    userId,
    type: "ATTENDANCE_REMINDER",
    title: "Attendance reminder",
    message:
      "Please make sure your attendance is recorded.",
    link: "/attendance",
    dedupeKey: `attendance-reminder:${userId}:${new Date()
      .toISOString()
      .slice(0, 10)}`,
  });
}

export async function notifyWarning({
  organizationId,
  userId,
  warningId,
  message,
}: {
  organizationId: string;
  userId: string;
  warningId: string;
  message: string;
}) {
  return createNotification({
    organizationId,
    userId,
    type: "WARNING",
    title: "OPDesk warning",
    message,
    link: `/warnings/${warningId}`,
    dedupeKey: `warning:${warningId}:${userId}`,
  });
}

export async function notifyEscalation({
  organizationId,
  userId,
  warningId,
  message,
}: {
  organizationId: string;
  userId: string;
  warningId: string;
  message: string;
}) {
  return createNotification({
    organizationId,
    userId,
    type: "ESCALATION",
    title: "OPDesk escalation",
    message,
    link: `/warnings/${warningId}`,
    dedupeKey: `escalation:${warningId}:${userId}`,
  });
}

/**
 * Keep NotificationType imported/used explicitly so
 * TypeScript catches accidental unsupported notification types.
 */
export function isNotificationType(
  value: string
): value is NotificationType {
  const types: NotificationType[] = [
    "TASK_ASSIGNED",
    "TASK_REMINDER",
    "TASK_OVERDUE",
    "TASK_SUBMITTED",
    "TASK_REVIEWED",
    "MEETING_INVITE",
    "MEETING_REMINDER",
    "MEETING_STARTING",
    "ATTENDANCE_REMINDER",
    "DAILY_UPDATE_REMINDER",
    "WARNING",
    "ESCALATION",
    "SYSTEM",
  ];

  return types.includes(value as NotificationType);
} 