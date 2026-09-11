import { NextResponse } from "next/server";
import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { canAccessTeam } from "@/lib/permissions";
import { db } from "@/db";
import { meetings, meetingParticipants, users, teams } from "@/db/schema";
import { createMeetingSchema } from "@/validations/meetings";
import { createNotification } from "@/services/notifications/notification.service";
import { logActivity } from "@/services/activity/activity.service";
import { getValidAccessToken } from "@/services/integrations/google-connection.service";
import { createGoogleCalendarEvent } from "@/services/integrations/google-calendar";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (process.env.DEMO_MODE === "true" || !db) return NextResponse.json({ meetings: [] });

  const url = new URL(req.url);
  const upcomingOnly = url.searchParams.get("upcoming") === "true";

  const rows = await db
    .select({
      id: meetings.id, title: meetings.title, description: meetings.description,
      organizerId: meetings.organizerId, organizerName: users.name,
      teamId: meetings.teamId, teamName: teams.name,
      startAt: meetings.startAt, endAt: meetings.endAt, meetingLink: meetings.meetingLink,
      status: meetings.status,
      participantCount: sql<number>`count(distinct ${meetingParticipants.id})`.mapWith(Number),
    })
    .from(meetings)
    .leftJoin(users, eq(meetings.organizerId, users.id))
    .leftJoin(teams, eq(meetings.teamId, teams.id))
    .leftJoin(meetingParticipants, eq(meetingParticipants.meetingId, meetings.id))
    .where(and(
      eq(meetings.organizationId, session.organizationId),
      upcomingOnly ? gte(meetings.endAt, new Date()) : undefined
    ))
    .groupBy(meetings.id, users.name, teams.name);

  if (session.role === "SUPER_ADMIN") {
    return NextResponse.json({ meetings: rows.sort((a, b) => +new Date(a.startAt) - +new Date(b.startAt)) });
  }

  // Visible if: organizer, an invited participant, or the meeting is
  // scoped to a team this person has view authority over.
  const myParticipation = await db.select({ meetingId: meetingParticipants.meetingId }).from(meetingParticipants).where(eq(meetingParticipants.userId, session.id));
  const participatingIds = new Set(myParticipation.map(p => p.meetingId));

  const distinctTeamIds = Array.from(new Set(rows.map(r => r.teamId).filter((id): id is string => Boolean(id))));
  const teamAccess = new Map<string, boolean>();
  await Promise.all(distinctTeamIds.map(async id => teamAccess.set(id, await canAccessTeam(session, id, "teams.view"))));

  const visible = rows.filter(r =>
    r.organizerId === session.id ||
    participatingIds.has(r.id) ||
    (r.teamId && teamAccess.get(r.teamId))
  );

  return NextResponse.json({ meetings: visible.sort((a, b) => +new Date(a.startAt) - +new Date(b.startAt)) });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (process.env.DEMO_MODE === "true") {
    return NextResponse.json({ error: "Creating meetings is disabled in demo mode. Connect a database to enable this." }, { status: 400 });
  }
  if (!db) return NextResponse.json({ error: "Database not configured" }, { status: 500 });

  const body = await req.json().catch(() => null);
  const parsed = createMeetingSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 422 });
  const input = parsed.data;

  const [created] = await db.insert(meetings).values({
    organizationId: session.organizationId,
    organizerId: session.id,
    teamId: input.teamId ?? null,
    title: input.title,
    description: input.description ?? null,
    startAt: new Date(input.startAt),
    endAt: new Date(input.endAt),
    meetingLink: input.meetingLink ?? null,
    agenda: input.agenda ?? null,
  }).returning();

  const uniqueParticipantIds = Array.from(new Set(input.participantIds.filter(id => id !== session.id)));
  if (uniqueParticipantIds.length > 0) {
    await db.insert(meetingParticipants).values(
      uniqueParticipantIds.map(userId => ({ meetingId: created.id, userId }))
    ).onConflictDoNothing();

    await Promise.all(uniqueParticipantIds.map(userId =>
      createNotification({
        organizationId: session.organizationId, userId, type: "MEETING_INVITE",
        title: "New meeting invite", message: created.title, link: `/meetings/${created.id}`,
      })
    ));
  }

  // Best-effort Google Calendar sync: only if the organizer has connected
  // their account, and never lets a calendar failure block the meeting
  // itself from being created — OPDesk's own record is the source of truth.
  try {
    const accessToken = await getValidAccessToken(session.id);
    if (accessToken) {
      const attendeeEmails = uniqueParticipantIds.length > 0
        ? (await db.select({ email: users.email }).from(users).where(inArray(users.id, uniqueParticipantIds))).map(u => u.email)
        : [];
      const googleEventId = await createGoogleCalendarEvent(accessToken, {
        title: created.title,
        startAt: created.startAt.toISOString(),
        endAt: created.endAt.toISOString(),
        description: created.description ?? undefined,
        meetingLink: created.meetingLink ?? undefined,
        attendeeEmails,
      });
      await db.update(meetings).set({ googleEventId }).where(eq(meetings.id, created.id));
    }
  } catch (err) {
    console.error("Google Calendar sync failed for meeting", created.id, err);
  }

  await logActivity({
    organizationId: session.organizationId, userId: session.id, action: "MEETING_CREATED",
    entityType: "meeting", entityId: created.id, metadata: { title: created.title },
  });

  return NextResponse.json({ meeting: created }, { status: 201 });
}
