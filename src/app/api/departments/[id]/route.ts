import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { db } from "@/db";
import { departments } from "@/db/schema";
import { updateDepartmentSchema } from "@/validations/departments";
import { logActivity } from "@/services/activity/activity.service";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "SUPER_ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  if (!db) return NextResponse.json({ error: "Not available in demo mode" }, { status: 400 });

  const body = await req.json().catch(() => null);
  const parsed = updateDepartmentSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 422 });

  const [existing] = await db.select().from(departments).where(and(eq(departments.id, id), eq(departments.organizationId, session.organizationId)));
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [updated] = await db.update(departments).set(parsed.data).where(eq(departments.id, id)).returning();

  await logActivity({
    organizationId: session.organizationId, userId: session.id, action: "DEPARTMENT_UPDATED",
    entityType: "department", entityId: id, metadata: { changes: Object.keys(parsed.data) },
  });

  return NextResponse.json({ department: updated });
}
