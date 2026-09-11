import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { getSession } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { db } from "@/db";
import { teams, users, teamMembers, departments } from "@/db/schema";
import { createTeamSchema } from "@/validations/teams";
import { logActivity } from "@/services/activity/activity.service";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (process.env.DEMO_MODE === "true") {
    return NextResponse.json({
      teams: [
        { id: "team-102", name: "Web Development", code: "102", leadUserId: "u-lead", leadName: "Team Lead", hrUserId: null, hrName: null, departmentName: null, memberCount: 2, active: true },
        { id: "team-103", name: "Design & Creative", code: "103", leadUserId: "u-lead", leadName: "Team Lead", hrUserId: null, hrName: null, departmentName: null, memberCount: 1, active: true },
        { id: "team-111", name: "Operations", code: "111", leadUserId: "u-lead", leadName: "Team Lead", hrUserId: null, hrName: null, departmentName: null, memberCount: 1, active: true },
      ],
    });
  }

  if (!db) return NextResponse.json({ teams: [] });

  const leadUser = alias(users, "lead_user");
  const hrUser = alias(users, "hr_user");

  const rows = await db
    .select({
      id: teams.id,
      name: teams.name,
      code: teams.code,
      description: teams.description,
      active: teams.active,
      departmentId: teams.departmentId,
      departmentName: departments.name,
      leadUserId: teams.leadUserId,
      leadName: leadUser.name,
      hrUserId: teams.hrUserId,
      hrName: hrUser.name,
      memberCount: sql<number>`count(distinct ${teamMembers.userId})`.mapWith(Number),
    })
    .from(teams)
    .leftJoin(departments, eq(teams.departmentId, departments.id))
    .leftJoin(leadUser, eq(leadUser.id, teams.leadUserId))
    .leftJoin(hrUser, eq(hrUser.id, teams.hrUserId))
    .leftJoin(teamMembers, eq(teamMembers.teamId, teams.id))
    .where(eq(teams.organizationId, session.organizationId))
    .groupBy(teams.id, departments.name, leadUser.name, hrUser.name);

  return NextResponse.json({ teams: rows });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const allowed = session.role === "SUPER_ADMIN" || (await hasPermission(session, "teams.create"));
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (process.env.DEMO_MODE === "true") {
    return NextResponse.json({ error: "Creating teams is disabled in demo mode. Connect a database to enable this." }, { status: 400 });
  }
  if (!db) return NextResponse.json({ error: "Database not configured" }, { status: 500 });

  const body = await req.json().catch(() => null);
  const parsed = createTeamSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 422 });
  }
  const input = parsed.data;
  const code = input.code.toUpperCase();

  const [existingCode] = await db
    .select({ id: teams.id })
    .from(teams)
    .where(and(eq(teams.organizationId, session.organizationId), eq(teams.code, code)));
  if (existingCode) {
    return NextResponse.json({ error: `Team code "${code}" is already in use` }, { status: 409 });
  }

  const [created] = await db
    .insert(teams)
    .values({
      organizationId: session.organizationId,
      name: input.name,
      code,
      description: input.description ?? null,
      departmentId: input.departmentId ?? null,
      leadUserId: input.leadUserId ?? null,
      hrUserId: input.hrUserId ?? null,
    })
    .returning();

  await logActivity({
    organizationId: session.organizationId,
    userId: session.id,
    action: "TEAM_CREATED",
    entityType: "team",
    entityId: created.id,
    metadata: { name: created.name, code: created.code },
  });

  return NextResponse.json({ team: created }, { status: 201 });
}
