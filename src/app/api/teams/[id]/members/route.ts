import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { canAccessTeam } from "@/lib/permissions";
import { db } from "@/db";
import { teamMembers, teams, users } from "@/db/schema";
import { teamMemberSchema } from "@/validations/teams";
import { logActivity } from "@/services/activity/activity.service";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: teamId } = await params;

  const allowed = await canAccessTeam(session, teamId, "teams.manage_members");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!db) return NextResponse.json({ error: "Not available in demo mode" }, { status: 400 });

  const body = await req.json().catch(() => null);
  const parsed = teamMemberSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 422 });

  const [team] = await db.select({ id: teams.id }).from(teams).where(and(eq(teams.id, teamId), eq(teams.organizationId, session.organizationId)));
  if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });

  const [person] = await db.select({ id: users.id }).from(users).where(and(eq(users.id, parsed.data.userId), eq(users.organizationId, session.organizationId)));
  if (!person) return NextResponse.json({ error: "Person not found" }, { status: 404 });

  const [existing] = await db.select({ id: teamMembers.id }).from(teamMembers).where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, parsed.data.userId)));
  if (existing) return NextResponse.json({ error: "Already a member of this team" }, { status: 409 });

  await db.insert(teamMembers).values({ teamId, userId: parsed.data.userId });
  // Keep the person's primary team in sync for dashboards/scoping.
  await db.update(users).set({ teamId }).where(eq(users.id, parsed.data.userId));

  await logActivity({
    organizationId: session.organizationId, userId: session.id, action: "TEAM_MEMBER_ADDED",
    entityType: "team", entityId: teamId, metadata: { addedUserId: parsed.data.userId },
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function DELETE(req: Request, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: teamId } = await params;

  const allowed = await canAccessTeam(session, teamId, "teams.manage_members");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!db) return NextResponse.json({ error: "Not available in demo mode" }, { status: 400 });

  const url = new URL(req.url);
  const userId = url.searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId is required" }, { status: 422 });

  await db.delete(teamMembers).where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)));
  await db.update(users).set({ teamId: null }).where(and(eq(users.id, userId), eq(users.teamId, teamId)));

  await logActivity({
    organizationId: session.organizationId, userId: session.id, action: "TEAM_MEMBER_REMOVED",
    entityType: "team", entityId: teamId, metadata: { removedUserId: userId },
  });

  return NextResponse.json({ ok: true });
}
