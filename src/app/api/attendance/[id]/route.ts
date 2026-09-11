import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { correctAttendance, AttendanceError } from "@/services/attendance/attendance.service";
import { correctAttendanceSchema } from "@/validations/attendance";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const allowed = session.role === "SUPER_ADMIN" || (await hasPermission(session, "attendance.correct"));
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (process.env.DEMO_MODE === "true") {
    return NextResponse.json({ error: "Not available in demo mode" }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const parsed = correctAttendanceSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 422 });

  const { reason, ...updates } = parsed.data;

  try {
    const updated = await correctAttendance(session.organizationId, session.id, id, updates, reason);
    return NextResponse.json({ record: updated });
  } catch (e) {
    if (e instanceof AttendanceError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
}
