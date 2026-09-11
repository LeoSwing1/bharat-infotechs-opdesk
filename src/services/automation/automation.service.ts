import { db } from "@/db";
import { automationRuns, tasks, users, meetings, meetingParticipants, dailyUpdates, attendance } from "@/db/schema";
import { and, eq, lt, gt, gte, lte, ne, isNull, isNotNull } from "drizzle-orm";
import { localDateString, localHour } from "@/lib/time";
import {
  notifyTaskReminder, notifyTaskOverdue, notifyMeetingReminder,
  notifyDailyUpdateReminder, createNotification,
} from "@/services/notifications/notification.service";

function todayDateString(d: Date = new Date()): string {
  return localDateString(d);
}

/**
 * Runs one sweep across every rule this automation engine knows about.
 * Meant to be called periodically by an external scheduler (cron / Vercel
 * Cron) hitting POST /api/automation/run with AUTOMATION_SECRET.
 *
 * Every notification here goes through the shared notification helpers
 * (which call createNotification()), not a raw table insert — that's what
 * makes push notifications, in-app notifications, and dedupe logic all
 * stay in sync automatically instead of each automation rule needing to
 * remember to wire push support itself.
 */
export async function runAutomationSweep() {
  if (!db) return { mode: "demo", reminders: 0, overdue: 0, meetingReminders: 0, missingClockOuts: 0, dailyUpdateReminders: 0 };

  const now = new Date();
  const orgs = await db.select({ id: users.organizationId }).from(users);
  const uniqueOrgs = [...new Set(orgs.map(x => x.id))];

  let reminders = 0, overdue = 0, meetingReminders = 0, missingClockOuts = 0, dailyUpdateReminders = 0;

  for (const organizationId of uniqueOrgs) {
    // --- Task overdue -------------------------------------------------
    const due = await db.select().from(tasks).where(and(
      eq(tasks.organizationId, organizationId), lt(tasks.deadline, now), ne(tasks.status, "APPROVED")
    ));
    for (const task of due) {
      await db.update(tasks).set({ status: "OVERDUE", updatedAt: now }).where(eq(tasks.id, task.id));
      if (task.assigneeId) {
        const result = await notifyTaskOverdue({ organizationId, userId: task.assigneeId, taskId: task.id, taskTitle: task.title });
        if (result.status === "CREATED") overdue++;
      }
    }

    // --- Task reminder --------------------------------------------------
    const remind = await db.select().from(tasks).where(and(
      eq(tasks.organizationId, organizationId), lt(tasks.reminderAt, now), ne(tasks.status, "APPROVED")
    ));
    for (const task of remind) {
      if (task.assigneeId) {
        const result = await notifyTaskReminder({ organizationId, userId: task.assigneeId, taskId: task.id, taskTitle: task.title });
        if (result.status === "CREATED") reminders++;
      }
    }

    // --- Meeting reminders: ~30 min and ~15 min before start -----------
    const upcoming = await db.select().from(meetings).where(and(
      eq(meetings.organizationId, organizationId), eq(meetings.status, "SCHEDULED"),
      gt(meetings.startAt, now)
    ));
    for (const meeting of upcoming) {
      const minutesUntil = (meeting.startAt.getTime() - now.getTime()) / 60000;
      let bucket: 30 | 15 | null = null;
      if (minutesUntil <= 30 && minutesUntil > 15) bucket = 30;
      else if (minutesUntil <= 15 && minutesUntil > 0) bucket = 15;
      if (!bucket) continue;

      const participantRows = await db.select({ userId: meetingParticipants.userId }).from(meetingParticipants).where(eq(meetingParticipants.meetingId, meeting.id));
      const recipientIds = Array.from(new Set([meeting.organizerId, ...participantRows.map(p => p.userId)]));
      for (const userId of recipientIds) {
        const result = await notifyMeetingReminder({ organizationId, userId, meetingId: meeting.id, meetingTitle: meeting.title, minutesBefore: bucket });
        if (result.status === "CREATED") meetingReminders++;
      }
    }

    // --- Missing clock-out: clocked in on a past day, never clocked out -
    const dangling = await db.select().from(attendance).where(and(
      eq(attendance.organizationId, organizationId),
      isNotNull(attendance.clockInAt), isNull(attendance.clockOutAt),
      lt(attendance.attendanceDate, todayDateString(now))
    ));
    for (const record of dangling) {
      const result = await createNotification({
        organizationId, userId: record.userId, type: "ATTENDANCE_REMINDER",
        title: "Missing clock-out", message: `You didn't clock out on ${record.attendanceDate}. Please let your manager know if this needs correcting.`,
        link: "/attendance", dedupeKey: `missing-clockout:${record.id}`,
      });
      if (result.status === "CREATED") missingClockOuts++;
    }

    // --- Daily update reminder: after 6pm, active users with no update today ---
    if (localHour(now) >= 18) {
      const today = todayDateString(now);
      const activeUsers = await db.select({ id: users.id }).from(users).where(and(eq(users.organizationId, organizationId), eq(users.status, "ACTIVE")));
      const submittedToday = await db.select({ userId: dailyUpdates.userId }).from(dailyUpdates).where(and(eq(dailyUpdates.organizationId, organizationId), eq(dailyUpdates.updateDate, today)));
      const submittedIds = new Set(submittedToday.map(s => s.userId));

      for (const person of activeUsers) {
        if (submittedIds.has(person.id)) continue;
        const result = await notifyDailyUpdateReminder({ organizationId, userId: person.id });
        if (result.status === "CREATED") dailyUpdateReminders++;
      }
    }
  }

  await db.insert(automationRuns).values({
    organizationId: uniqueOrgs[0] ?? "system",
    rule: "SWEEP_COMPLETED",
    dedupeKey: `sweep:${now.toISOString()}`,
  }).onConflictDoNothing();

  return { reminders, overdue, meetingReminders, missingClockOuts, dailyUpdateReminders };
}
