import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import type { SessionUser } from "@/lib/auth";
import { db } from "@/db";
import { projects, projectMembers, users } from "@/db/schema";
import { projectMemberSchema } from "@/validations/projects";
import { logActivity } from "@/services/activity/activity.service";
import { canManageProject } from "@/services/projects/access";

type Params = { params: Promise<{ id: string }> };

async function canManage(session: SessionUser, projectId: string) {
  if (!db) return false;
  const [project] = await db.select().from(projects).where(and(eq(projects.id, projectId), eq(projects.organizationId, session.organizationId)));
  if (!project) return null;
  return (await canManageProject(session, project)) ? project : false;
}

export async function POST(req: Request, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: projectId } = await params;
  if (!db) return NextResponse.json({ error: "Not available in demo mode" }, { status: 400 });

  const project = await canManage(session, projectId);
  if (project === null) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!project) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const parsed = projectMemberSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 422 });

  const [person] = await db.select({ id: users.id }).from(users).where(and(eq(users.id, parsed.data.userId), eq(users.organizationId, session.organizationId)));
  if (!person) return NextResponse.json({ error: "Person not found" }, { status: 404 });

  const [existing] = await db.select({ id: projectMembers.id }).from(projectMembers)
    .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, parsed.data.userId)));
  if (existing) return NextResponse.json({ error: "Already a member of this project" }, { status: 409 });

  await db.insert(projectMembers).values({ projectId, userId: parsed.data.userId });

  await logActivity({
    organizationId: session.organizationId, userId: session.id, action: "PROJECT_MEMBER_ADDED",
    entityType: "project", entityId: projectId, metadata: { addedUserId: parsed.data.userId },
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function DELETE(req: Request, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: projectId } = await params;
  if (!db) return NextResponse.json({ error: "Not available in demo mode" }, { status: 400 });

  const project = await canManage(session, projectId);
  if (project === null) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!project) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const url = new URL(req.url);
  const userId = url.searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId is required" }, { status: 422 });

  await db.delete(projectMembers).where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)));

  await logActivity({
    organizationId: session.organizationId, userId: session.id, action: "PROJECT_MEMBER_REMOVED",
    entityType: "project", entityId: projectId, metadata: { removedUserId: userId },
  });

  return NextResponse.json({ ok: true });
}
