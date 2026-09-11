import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { db } from "@/db";
import { shifts } from "@/db/schema";
import { createShiftSchema } from "@/validations/shifts";
import { logActivity } from "@/services/activity/activity.service";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (process.env.DEMO_MODE === "true" || !db) return NextResponse.json({ shifts: [] });

  const rows = await db.select().from(shifts).where(eq(shifts.organizationId, session.organizationId));
  return NextResponse.json({ shifts: rows });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const allowed = session.role === "SUPER_ADMIN" || (await hasPermission(session, "attendance.manage_shifts"));
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (process.env.DEMO_MODE === "true") {
    return NextResponse.json({ error: "Creating shifts is disabled in demo mode. Connect a database to enable this." }, { status: 400 });
  }
  if (!db) return NextResponse.json({ error: "Database not configured" }, { status: 500 });

  const body = await req.json().catch(() => null);
  const parsed = createShiftSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 422 });

  const input = parsed.data;
  const code = input.code.toUpperCase();

  const [existing] = await db.select({ id: shifts.id }).from(shifts)
    .where(and(eq(shifts.organizationId, session.organizationId), eq(shifts.code, code)));
  if (existing) return NextResponse.json({ error: `Shift code "${code}" is already in use` }, { status: 409 });

  const [created] = await db.insert(shifts).values({
    organizationId: session.organizationId,
    name: input.name,
    code,
    startTime: input.startTime,
    endTime: input.endTime,
    gracePeriodMinutes: input.gracePeriodMinutes,
  }).returning();

  await logActivity({
    organizationId: session.organizationId, userId: session.id, action: "SHIFT_CREATED",
    entityType: "shift", entityId: created.id, metadata: { name: created.name, code: created.code },
  });

  return NextResponse.json({ shift: created }, { status: 201 });
}
