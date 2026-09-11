import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { resolveAttendanceScope, ScopeForbiddenError } from "@/services/attendance/scope";
import { listAttendance, getShiftMinutesByUser, computeOvertimeMinutes } from "@/services/attendance/attendance.service";
import { db } from "@/db";
import { users } from "@/db/schema";

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function minutesToHours(min: number | null | undefined): string {
  if (min == null) return "";
  return (min / 60).toFixed(2);
}

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (process.env.DEMO_MODE === "true" || !db) {
    return NextResponse.json({ error: "Not available in demo mode" }, { status: 400 });
  }

  const url = new URL(req.url);
  const from = url.searchParams.get("from") ?? undefined;
  const to = url.searchParams.get("to") ?? undefined;

  let scope;
  try {
    scope = await resolveAttendanceScope(session, url.searchParams.get("userId") ?? undefined, url.searchParams.get("teamId") ?? undefined);
  } catch (e) {
    if (e instanceof ScopeForbiddenError) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    throw e;
  }

  const records = await listAttendance(session.organizationId, { ...scope, from, to });
  const userIds = Array.from(new Set(records.map(r => r.userId)));
  const shiftMinutesByUser = await getShiftMinutesByUser(userIds);

  const people = userIds.length > 0
    ? await db.select({ id: users.id, name: users.name, employeeCode: users.employeeCode }).from(users)
    : [];
  const nameById = new Map(people.map(p => [p.id, p]));

  const header = ["Employee", "Employee ID", "Date", "Status", "Clock In", "Clock Out", "Break (hrs)", "Worked (hrs)", "Overtime (hrs)"];
  const lines = [header.map(csvEscape).join(",")];

  for (const r of records) {
    const person = nameById.get(r.userId);
    const overtime = computeOvertimeMinutes(r.workedMinutes, shiftMinutesByUser.get(r.userId));
    lines.push([
      person?.name ?? r.userId,
      person?.employeeCode ?? "",
      r.attendanceDate,
      r.status,
      r.clockInAt ? new Date(r.clockInAt).toLocaleString() : "",
      r.clockOutAt ? new Date(r.clockOutAt).toLocaleString() : "",
      minutesToHours(r.breakMinutes),
      minutesToHours(r.workedMinutes),
      minutesToHours(overtime),
    ].map(v => csvEscape(String(v))).join(","));
  }

  const csv = lines.join("\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="timesheet-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
