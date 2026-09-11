import { and, eq, gte, lte, desc, inArray } from "drizzle-orm";
import { db } from "@/db";
import { attendance, attendanceEvents, users, shifts } from "@/db/schema";
import { logActivity } from "@/services/activity/activity.service";
import { localDateString, localHour } from "@/lib/time";

// Fallback defaults for anyone with no shift assigned. Times are in the
// server's local hour (kept simple; a real multi-timezone org would want
// this per-organization and timezone-aware).
const DEFAULT_START_HOUR = 9.5; // 9:30 AM
const DEFAULT_GRACE_MINUTES = 15;
const DEFAULT_SHIFT_MINUTES = 8 * 60; // used for overtime calculation

export class AttendanceError extends Error {}

function todayDateString(d: Date = new Date()): string {
  return localDateString(d);
}

function hourOfDay(d: Date): number {
  return localHour(d);
}

/** Parses a Postgres `time` string ("09:30:00") into a fractional hour. */
function parseTimeToHour(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h + (m ?? 0) / 60;
}

/** Resolves the shift a person is expected to work, if any is assigned. */
async function getAssignedShift(userId: string) {
  if (!db) return null;
  const [row] = await db
    .select({ shift: shifts })
    .from(users)
    .innerJoin(shifts, eq(users.shiftId, shifts.id))
    .where(eq(users.id, userId));
  return row?.shift ?? null;
}

async function getRow(organizationId: string, userId: string, dateStr: string) {
  if (!db) return null;
  const [row] = await db
    .select()
    .from(attendance)
    .where(and(eq(attendance.organizationId, organizationId), eq(attendance.userId, userId), eq(attendance.attendanceDate, dateStr)));
  return row ?? null;
}

async function getEvents(organizationId: string, userId: string, dateStr: string) {
  if (!db) return [];
  return db
    .select()
    .from(attendanceEvents)
    .where(and(eq(attendanceEvents.organizationId, organizationId), eq(attendanceEvents.userId, userId), eq(attendanceEvents.attendanceDate, dateStr)))
    .orderBy(attendanceEvents.occurredAt);
}

/** Returns today's attendance row + events, with live-computed worked/break minutes if still clocked in. */
export async function getTodayStatus(organizationId: string, userId: string) {
  if (!db) throw new AttendanceError("Not available in demo mode");
  const dateStr = todayDateString();
  const [row, events] = await Promise.all([
    getRow(organizationId, userId, dateStr),
    getEvents(organizationId, userId, dateStr),
  ]);

  const onBreak = events.length > 0 && events[events.length - 1].type === "BREAK_START";
  const clockedIn = Boolean(row?.clockInAt) && !row?.clockOutAt;

  let liveWorkedMinutes = row?.workedMinutes ?? null;
  let liveBreakMinutes = row?.breakMinutes ?? 0;

  if (row?.clockInAt && !row.clockOutAt) {
    const now = new Date();
    const grossMinutes = Math.floor((now.getTime() - new Date(row.clockInAt).getTime()) / 60000);
    let ongoingBreakMinutes = 0;
    if (onBreak) {
      const lastBreakStart = events[events.length - 1].occurredAt;
      ongoingBreakMinutes = Math.floor((now.getTime() - new Date(lastBreakStart).getTime()) / 60000);
    }
    liveBreakMinutes = (row.breakMinutes ?? 0) + ongoingBreakMinutes;
    liveWorkedMinutes = Math.max(0, grossMinutes - liveBreakMinutes);
  }

  const shift = await getAssignedShift(userId);
  let lateMinutes = 0;
  if (row?.clockInAt) {
    const startHour = shift ? parseTimeToHour(shift.startTime) : DEFAULT_START_HOUR;
    const graceMinutes = shift?.gracePeriodMinutes ?? DEFAULT_GRACE_MINUTES;
    const actualHour = hourOfDay(new Date(row.clockInAt));
    lateMinutes = Math.max(0, Math.floor((actualHour - (startHour + graceMinutes / 60)) * 60));
  }

  return {
    row,
    events,
    onBreak,
    clockedIn,
    liveWorkedMinutes,
    liveBreakMinutes,
    date: dateStr,
    shift: shift ? { id: shift.id, name: shift.name, code: shift.code, startTime: shift.startTime, endTime: shift.endTime, gracePeriodMinutes: shift.gracePeriodMinutes } : null,
    lateMinutes,
  };
}

export async function clockIn(organizationId: string, userId: string) {
  if (!db) throw new AttendanceError("Not available in demo mode");
  const dateStr = todayDateString();
  const existing = await getRow(organizationId, userId, dateStr);
  if (existing?.clockInAt) throw new AttendanceError("Already clocked in today");

  const now = new Date();
  const shift = await getAssignedShift(userId);
  const startHour = shift ? parseTimeToHour(shift.startTime) : DEFAULT_START_HOUR;
  const graceMinutes = shift?.gracePeriodMinutes ?? DEFAULT_GRACE_MINUTES;
  const lateAfterHour = startHour + graceMinutes / 60;
  const status = hourOfDay(now) > lateAfterHour ? "LATE" : "PRESENT";

  await db.insert(attendanceEvents).values({ organizationId, userId, attendanceDate: dateStr, type: "CLOCK_IN", occurredAt: now });

  if (existing) {
    await db.update(attendance).set({ clockInAt: now, status, updatedAt: now }).where(eq(attendance.id, existing.id));
  } else {
    await db.insert(attendance).values({ organizationId, userId, attendanceDate: dateStr, status, clockInAt: now });
  }

  return getTodayStatus(organizationId, userId);
}

export async function clockOut(organizationId: string, userId: string) {
  if (!db) throw new AttendanceError("Not available in demo mode");
  const dateStr = todayDateString();
  const existing = await getRow(organizationId, userId, dateStr);
  if (!existing?.clockInAt) throw new AttendanceError("You haven't clocked in today");
  if (existing.clockOutAt) throw new AttendanceError("Already clocked out today");

  const events = await getEvents(organizationId, userId, dateStr);
  const now = new Date();
  let breakMinutes = existing.breakMinutes ?? 0;

  // Auto-close a dangling break so clock-out always leaves a consistent state.
  if (events.length > 0 && events[events.length - 1].type === "BREAK_START") {
    const started = events[events.length - 1].occurredAt;
    breakMinutes += Math.floor((now.getTime() - new Date(started).getTime()) / 60000);
    await db.insert(attendanceEvents).values({ organizationId, userId, attendanceDate: dateStr, type: "BREAK_END", occurredAt: now, note: "Auto-closed at clock-out" });
  }

  await db.insert(attendanceEvents).values({ organizationId, userId, attendanceDate: dateStr, type: "CLOCK_OUT", occurredAt: now });

  const grossMinutes = Math.floor((now.getTime() - new Date(existing.clockInAt).getTime()) / 60000);
  const workedMinutes = Math.max(0, grossMinutes - breakMinutes);

  await db.update(attendance).set({ clockOutAt: now, breakMinutes, workedMinutes, updatedAt: now }).where(eq(attendance.id, existing.id));

  return getTodayStatus(organizationId, userId);
}

export async function startBreak(organizationId: string, userId: string) {
  if (!db) throw new AttendanceError("Not available in demo mode");
  const dateStr = todayDateString();
  const existing = await getRow(organizationId, userId, dateStr);
  if (!existing?.clockInAt) throw new AttendanceError("Clock in before starting a break");
  if (existing.clockOutAt) throw new AttendanceError("You've already clocked out today");

  const events = await getEvents(organizationId, userId, dateStr);
  if (events.length > 0 && events[events.length - 1].type === "BREAK_START") {
    throw new AttendanceError("Break already in progress");
  }

  await db.insert(attendanceEvents).values({ organizationId, userId, attendanceDate: dateStr, type: "BREAK_START", occurredAt: new Date() });
  return getTodayStatus(organizationId, userId);
}

export async function endBreak(organizationId: string, userId: string) {
  if (!db) throw new AttendanceError("Not available in demo mode");
  const dateStr = todayDateString();
  const existing = await getRow(organizationId, userId, dateStr);
  if (!existing) throw new AttendanceError("No attendance record for today");

  const events = await getEvents(organizationId, userId, dateStr);
  const last = events[events.length - 1];
  if (!last || last.type !== "BREAK_START") throw new AttendanceError("No break in progress");

  const now = new Date();
  const minutes = Math.floor((now.getTime() - new Date(last.occurredAt).getTime()) / 60000);

  await db.insert(attendanceEvents).values({ organizationId, userId, attendanceDate: dateStr, type: "BREAK_END", occurredAt: now });
  await db.update(attendance).set({ breakMinutes: (existing.breakMinutes ?? 0) + minutes, updatedAt: now }).where(eq(attendance.id, existing.id));

  return getTodayStatus(organizationId, userId);
}

export async function listAttendance(organizationId: string, filters: { userId?: string; userIds?: string[]; from?: string; to?: string }) {
  if (!db) return [];
  const conditions = [eq(attendance.organizationId, organizationId)];
  if (filters.userId) conditions.push(eq(attendance.userId, filters.userId));
  else if (filters.userIds) {
    if (filters.userIds.length === 0) return [];
    conditions.push(inArray(attendance.userId, filters.userIds));
  }
  if (filters.from) conditions.push(gte(attendance.attendanceDate, filters.from));
  if (filters.to) conditions.push(lte(attendance.attendanceDate, filters.to));

  return db.select().from(attendance).where(and(...conditions)).orderBy(desc(attendance.attendanceDate));
}

/** Standard shift length in minutes for a set of users, keyed by userId — falls back to the 8h default for anyone with no shift assigned. */
export async function getShiftMinutesByUser(userIds: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (!db || userIds.length === 0) return map;

  const rows = await db
    .select({ userId: users.id, startTime: shifts.startTime, endTime: shifts.endTime })
    .from(users)
    .innerJoin(shifts, eq(users.shiftId, shifts.id))
    .where(inArray(users.id, userIds));

  for (const row of rows) {
    const start = parseTimeToHour(row.startTime);
    let end = parseTimeToHour(row.endTime);
    if (end <= start) end += 24; // overnight shift
    map.set(row.userId, Math.round((end - start) * 60));
  }
  return map;
}

export function computeOvertimeMinutes(workedMinutes: number | null, shiftMinutes: number = DEFAULT_SHIFT_MINUTES): number {
  if (workedMinutes == null) return 0;
  return Math.max(0, workedMinutes - shiftMinutes);
}

export async function correctAttendance(
  organizationId: string,
  actorId: string,
  attendanceId: string,
  updates: { status?: string; clockInAt?: string; clockOutAt?: string; breakMinutes?: number },
  reason: string
) {
  if (!db) throw new AttendanceError("Not available in demo mode");
  const [before] = await db.select().from(attendance).where(and(eq(attendance.id, attendanceId), eq(attendance.organizationId, organizationId)));
  if (!before) throw new AttendanceError("Attendance record not found");

  const clockInAt = updates.clockInAt ? new Date(updates.clockInAt) : before.clockInAt;
  const clockOutAt = updates.clockOutAt ? new Date(updates.clockOutAt) : before.clockOutAt;
  const breakMinutes = updates.breakMinutes ?? before.breakMinutes ?? 0;
  const workedMinutes = clockInAt && clockOutAt
    ? Math.max(0, Math.floor((clockOutAt.getTime() - clockInAt.getTime()) / 60000) - breakMinutes)
    : before.workedMinutes;

  const [updated] = await db
    .update(attendance)
    .set({
      status: (updates.status as typeof before.status) ?? before.status,
      clockInAt, clockOutAt, breakMinutes, workedMinutes,
      correctedBy: actorId,
      correctionReason: reason,
      updatedAt: new Date(),
    })
    .where(eq(attendance.id, attendanceId))
    .returning();

  await logActivity({
    organizationId, userId: actorId, action: "ATTENDANCE_CORRECTED",
    entityType: "attendance", entityId: attendanceId,
    metadata: { before, after: updated, reason },
  });

  return updated;
}
