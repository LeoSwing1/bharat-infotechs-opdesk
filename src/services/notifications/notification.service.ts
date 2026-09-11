import "server-only";

import { and, desc, eq, isNull } from "drizzle-orm";

import { db } from "@/db";
import { notifications } from "@/db/schema";
import { sendPushToUser } from "@/services/push/push.service";

import type {
  CreateNotificationInput,
  NotificationType,
} from "./notification.types";

/*
|--------------------------------------------------------------------------
| DEMO NOTIFICATION STORE
|--------------------------------------------------------------------------
|
| Demo mode does not use PostgreSQL, so we keep notifications in memory.
| This allows the notification bell to work during development.
|
*/

type DemoNotification = CreateNotificationInput & {
  id: string;
  readAt: Date | null;
  createdAt: Date;
};

const demoNotifications: DemoNotification[] = [];

/*
|--------------------------------------------------------------------------
| CREATE NOTIFICATION
|--------------------------------------------------------------------------
*/

export async function createNotification(
  input: CreateNotificationInput
) {
  /*
   * DEMO MODE
   */
  if (process.env.DEMO_MODE === "true") {
    /*
     * Prevent duplicate notifications.
     */
    if (input.dedupeKey) {
      const existing = demoNotifications.find(
        (notification) =>
          notification.userId === input.userId &&
          notification.dedupeKey === input.dedupeKey
      );

      if (existing) {
        return {
          ok: true,
          status: "DUPLICATE" as const,
          notification: existing,
        };
      }
    }

    const notification: DemoNotification = {
      id: `demo-notification-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}`,

      ...input,

      readAt: null,
      createdAt: new Date(),
    };

    demoNotifications.unshift(notification);

    console.log(
      "[OPDesk Notification]",
      notification
    );

    return {
      ok: true,
      status: "DEMO_MODE" as const,
      notification,
    };
  }

  /*
   * DATABASE MODE
   */

  if (!db) {
    return {
      ok: false,
      status: "NOT_CONFIGURED" as const,
      notification: null,
    };
  }

  try {
    /*
     * Dedupe check
     */
    if (input.dedupeKey) {
      const [existing] = await db
        .select()
        .from(notifications)
        .where(
          and(
            eq(
              notifications.userId,
              input.userId
            ),
            eq(
              notifications.dedupeKey,
              input.dedupeKey
            )
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

    // Best-effort push delivery: awaited so it actually completes before
    // this request lifecycle ends (serverless functions can freeze
    // immediately after the response is sent), but its failure never
    // fails the in-app notification, which is already saved above.
    try {
      await sendPushToUser(input.userId, { title: input.title, body: input.message, link: input.link });
    } catch (err) {
      console.error("[OPDesk Notification] Push delivery failed:", err);
    }

    return {
      ok: true,
      status: "CREATED" as const,
      notification,
    };
  } catch (error) {
    console.error(
      "[OPDesk Notification] Failed:",
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

/*
|--------------------------------------------------------------------------
| GET USER NOTIFICATIONS
|--------------------------------------------------------------------------
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
  /*
   * DEMO MODE
   */
  if (process.env.DEMO_MODE === "true") {
    const result = demoNotifications
      .filter(
        (notification) =>
          notification.userId === userId
      )
      .filter(
        (notification) =>
          !unreadOnly ||
          notification.readAt === null
      )
      .sort(
        (a, b) =>
          b.createdAt.getTime() -
          a.createdAt.getTime()
      )
      .slice(
        0,
        Math.min(
          Math.max(limit, 1),
          100
        )
      );

    return result;
  }

  /*
   * DATABASE MODE
   */

  if (!db) {
    return [];
  }

  const condition = unreadOnly
    ? and(
        eq(
          notifications.userId,
          userId
        ),
        isNull(
          notifications.readAt
        )
      )
    : eq(
        notifications.userId,
        userId
      );

  return db
    .select()
    .from(notifications)
    .where(condition)
    .orderBy(
      desc(
        notifications.createdAt
      )
    )
    .limit(
      Math.min(
        Math.max(limit, 1),
        100
      )
    );
}

/*
|--------------------------------------------------------------------------
| UNREAD COUNT
|--------------------------------------------------------------------------
*/

export async function getUnreadNotificationCount(
  userId: string
) {
  /*
   * DEMO MODE
   */
  if (process.env.DEMO_MODE === "true") {
    return demoNotifications.filter(
      (notification) =>
        notification.userId === userId &&
        notification.readAt === null
    ).length;
  }

  /*
   * DATABASE MODE
   */

  if (!db) {
    return 0;
  }

  const rows = await db
    .select({
      id: notifications.id,
    })
    .from(notifications)
    .where(
      and(
        eq(
          notifications.userId,
          userId
        ),
        isNull(
          notifications.readAt
        )
      )
    );

  return rows.length;
}

/*
|--------------------------------------------------------------------------
| MARK ONE AS READ
|--------------------------------------------------------------------------
*/

export async function markNotificationAsRead({
  notificationId,
  userId,
}: {
  notificationId: string;
  userId: string;
}) {
  /*
   * DEMO MODE
   */

  if (process.env.DEMO_MODE === "true") {
    const notification =
      demoNotifications.find(
        (item) =>
          item.id === notificationId &&
          item.userId === userId
      );

    if (!notification) {
      return {
        ok: false,
        status: "NOT_FOUND" as const,
      };
    }

    notification.readAt = new Date();

    return {
      ok: true,
      status: "READ" as const,
      notification,
    };
  }

  /*
   * DATABASE MODE
   */

  if (!db) {
    return {
      ok: false,
      status: "NOT_CONFIGURED" as const,
    };
  }

  const [notification] =
    await db
      .update(notifications)
      .set({
        readAt: new Date(),
      })
      .where(
        and(
          eq(
            notifications.id,
            notificationId
          ),
          eq(
            notifications.userId,
            userId
          )
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

/*
|--------------------------------------------------------------------------
| MARK ALL AS READ
|--------------------------------------------------------------------------
*/

export async function markAllNotificationsAsRead(
  userId: string
) {
  /*
   * DEMO MODE
   */

  if (process.env.DEMO_MODE === "true") {
    demoNotifications.forEach(
      (notification) => {
        if (
          notification.userId === userId &&
          notification.readAt === null
        ) {
          notification.readAt =
            new Date();
        }
      }
    );

    return {
      ok: true,
      status: "ALL_READ" as const,
    };
  }

  /*
   * DATABASE MODE
   */

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
        eq(
          notifications.userId,
          userId
        ),
        isNull(
          notifications.readAt
        )
      )
    );

  return {
    ok: true,
    status: "ALL_READ" as const,
  };
}

/*
|--------------------------------------------------------------------------
| TASK ASSIGNED
|--------------------------------------------------------------------------
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

/*
|--------------------------------------------------------------------------
| TASK REMINDER
|--------------------------------------------------------------------------
*/

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

/*
|--------------------------------------------------------------------------
| TASK OVERDUE
|--------------------------------------------------------------------------
*/

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

/*
|--------------------------------------------------------------------------
| MEETING REMINDER
|--------------------------------------------------------------------------
*/

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
  const type: NotificationType =
    minutesBefore <= 15
      ? "MEETING_STARTING"
      : "MEETING_REMINDER";

  return createNotification({
    organizationId,
    userId,
    type,
    title:
      minutesBefore <= 15
        ? "Meeting starting soon"
        : "Meeting reminder",
    message: `"${meetingTitle}" starts in approximately ${minutesBefore} minutes.`,
    link: `/meetings/${meetingId}`,
    dedupeKey: `meeting-reminder:${meetingId}:${userId}:${minutesBefore}`,
  });
}

/*
|--------------------------------------------------------------------------
| DAILY UPDATE REMINDER
|--------------------------------------------------------------------------
*/

export async function notifyDailyUpdateReminder({
  organizationId,
  userId,
}: {
  organizationId: string;
  userId: string;
}) {
  const date =
    new Date()
      .toISOString()
      .slice(0, 10);

  return createNotification({
    organizationId,
    userId,
    type: "DAILY_UPDATE_REMINDER",
    title: "Daily update reminder",
    message:
      "Please submit your daily work update in OPDesk.",
    link: "/daily-updates",
    dedupeKey:
      `daily-update-reminder:${userId}:${date}`,
  });
}

/*
|--------------------------------------------------------------------------
| ATTENDANCE REMINDER
|--------------------------------------------------------------------------
*/

export async function notifyAttendanceReminder({
  organizationId,
  userId,
}: {
  organizationId: string;
  userId: string;
}) {
  const date =
    new Date()
      .toISOString()
      .slice(0, 10);

  return createNotification({
    organizationId,
    userId,
    type: "ATTENDANCE_REMINDER",
    title: "Attendance reminder",
    message:
      "Please make sure your attendance is recorded.",
    link: "/attendance",
    dedupeKey:
      `attendance-reminder:${userId}:${date}`,
  });
}

/*
|--------------------------------------------------------------------------
| WARNING
|--------------------------------------------------------------------------
*/

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
    dedupeKey:
      `warning:${warningId}:${userId}`,
  });
}

/*
|--------------------------------------------------------------------------
| ESCALATION
|--------------------------------------------------------------------------
*/

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
    dedupeKey:
      `escalation:${warningId}:${userId}`,
  });
}

/*
|--------------------------------------------------------------------------
| TYPE CHECK
|--------------------------------------------------------------------------
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

  return types.includes(
    value as NotificationType
  );
}