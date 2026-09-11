import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { db } from "@/db";
import { departments, users, teams } from "@/db/schema";
import { createDepartmentSchema } from "@/validations/departments";
import { logActivity } from "@/services/activity/activity.service";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (process.env.DEMO_MODE === "true") {
    return NextResponse.json({ departments: [{ id: "dept-tech", name: "Technology", description: null, peopleCount: 0, teamCount: 0 }, { id: "dept-hr", name: "HR", description: null, peopleCount: 0, teamCount: 0 }] });
  }
  if (!db) return NextResponse.json({ departments: [] });

  const rows = await db
    .select({
      id: departments.id, name: departments.name, description: departments.description,
      peopleCount: sql<number>`count(distinct ${users.id})`.mapWith(Number),
      teamCount: sql<number>`count(distinct ${teams.id})`.mapWith(Number),
    })
    .from(departments)
    .leftJoin(users, eq(users.departmentId, departments.id))
    .leftJoin(teams, eq(teams.departmentId, departments.id))
    .where(eq(departments.organizationId, session.organizationId))
    .groupBy(departments.id);

  return NextResponse.json({ departments: rows });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Departments are org structure, same tier as team creation — Super
  // Admin only, matching how server checks are applied everywhere else
  // org-structural (creating teams, editing permissions).
  if (session.role !== "SUPER_ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (process.env.DEMO_MODE === "true") {
    return NextResponse.json({ error: "Creating departments is disabled in demo mode. Connect a database to enable this." }, { status: 400 });
  }
  if (!db) return NextResponse.json({ error: "Database not configured" }, { status: 500 });

  const body = await req.json().catch(() => null);
  const parsed = createDepartmentSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 422 });

  const [existing] = await db.select({ id: departments.id }).from(departments)
    .where(and(eq(departments.organizationId, session.organizationId), eq(departments.name, parsed.data.name)));
  if (existing) return NextResponse.json({ error: `A department named "${parsed.data.name}" already exists` }, { status: 409 });

  const [created] = await db.insert(departments).values({
    organizationId: session.organizationId,
    name: parsed.data.name,
    description: parsed.data.description ?? null,
  }).returning();

  await logActivity({
    organizationId: session.organizationId, userId: session.id, action: "DEPARTMENT_CREATED",
    entityType: "department", entityId: created.id, metadata: { name: created.name },
  });

  return NextResponse.json({ department: created }, { status: 201 });
}
