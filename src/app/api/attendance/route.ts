import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { resolveAttendanceScope, ScopeForbiddenError } from "@/services/attendance/scope";
import { listAttendance } from "@/services/attendance/attendance.service";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (process.env.DEMO_MODE === "true") return NextResponse.json({ records: [] });

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
  return NextResponse.json({ records });
}
