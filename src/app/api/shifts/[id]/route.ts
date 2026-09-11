import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { db } from "@/db";
import { shifts } from "@/db/schema";
import { updateShiftSchema } from "@/validations/shifts";
import { logActivity } from "@/services/activity/activity.service";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const allowed = session.role === "SUPER_ADMIN" || (await hasPermission(session, "attendance.manage_shifts"));
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (!db) return NextResponse.json({ error: "Not available in demo mode" }, { status: 400 });

  const body = await req.json().catch(() => null);
  const parsed = updateShiftSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 422 });

  const [existing] = await db.select().from(shifts).where(and(eq(shifts.id, id), eq(shifts.organizationId, session.organizationId)));
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const nextCode = parsed.data.code ? parsed.data.code.toUpperCase() : undefined;

  const [updated] = await db
    .update(shifts)
    .set({ ...parsed.data, code: nextCode })
    .where(and(eq(shifts.id, id), eq(shifts.organizationId, session.organizationId)))
    .returning();

  await logActivity({
    organizationId: session.organizationId, userId: session.id,
    action: parsed.data.active === false ? "SHIFT_ARCHIVED" : "SHIFT_UPDATED",
    entityType: "shift", entityId: id, metadata: { changes: Object.keys(parsed.data) },
  });

  return NextResponse.json({ shift: updated });
}
