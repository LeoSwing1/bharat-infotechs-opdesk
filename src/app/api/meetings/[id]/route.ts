import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { canAccessTeam } from "@/lib/permissions";
import type { SessionUser } from "@/lib/auth";
import { db } from "@/db";
import { meetings, meetingParticipants, users } from "@/db/schema";
import { updateMeetingSchema } from "@/validations/meetings";
import { logActivity } from "@/services/activity/activity.service";

type Params = { params: Promise<{ id: string }> };

async function canView(session: SessionUser, meeting: { organizerId: string; teamId: string | null }, isParticipant: boolean) {
  if (session.role === "SUPER_ADMIN") return true;
  if (meeting.organizerId === session.id || isParticipant) return true;
  if (meeting.teamId) return canAccessTeam(session, meeting.teamId, "teams.view");
  return false;
}

export async function GET(_req: Request, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!db) return NextResponse.json({ error: "Not available in demo mode" }, { status: 400 });

  const [meeting] = await db.select().from(meetings).where(and(eq(meetings.id, id), eq(meetings.organizationId, session.organizationId)));
  if (!meeting) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const participants = await db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(meetingParticipants)
    .innerJoin(users, eq(meetingParticipants.userId, users.id))
    .where(eq(meetingParticipants.meetingId, id));

  const isParticipant = participants.some(p => p.id === session.id);
  if (!(await canView(session, meeting, isParticipant))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  return NextResponse.json({ meeting, participants });
}

export async function PATCH(req: Request, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!db) return NextResponse.json({ error: "Not available in demo mode" }, { status: 400 });

  const [meeting] = await db.select().from(meetings).where(and(eq(meetings.id, id), eq(meetings.organizationId, session.organizationId)));
  if (!meeting) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const allowed = session.role === "SUPER_ADMIN" || meeting.organizerId === session.id;
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const parsed = updateMeetingSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 422 });
  const { startAt, endAt, ...rest } = parsed.data;

  const [updated] = await db.update(meetings)
    .set({
      ...rest,
      startAt: startAt ? new Date(startAt) : undefined,
      endAt: endAt ? new Date(endAt) : undefined,
    })
    .where(eq(meetings.id, id)).returning();

  await logActivity({
    organizationId: session.organizationId, userId: session.id, action: "MEETING_UPDATED",
    entityType: "meeting", entityId: id, metadata: { changes: Object.keys(parsed.data) },
  });

  return NextResponse.json({ meeting: updated });
}
