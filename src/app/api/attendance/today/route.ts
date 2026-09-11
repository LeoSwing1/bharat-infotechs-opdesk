import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getTodayStatus, AttendanceError } from "@/services/attendance/attendance.service";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (process.env.DEMO_MODE === "true") {
    return NextResponse.json({ available: false, reason: "DATABASE_REQUIRED" });
  }

  try {
    const status = await getTodayStatus(session.organizationId, session.id);
    return NextResponse.json({ available: true, ...status });
  } catch (e) {
    if (e instanceof AttendanceError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
}
