import { NextResponse } from "next/server";
import { and, eq, desc, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { conversations, conversationMembers, users, messages } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";

const createSchema = z.object({
  type: z.enum(["DIRECT","GROUP","SPACE"]),
  name: z.string().trim().max(120).optional(),
  description: z.string().max(500).optional(),
  memberIds: z.array(z.string().uuid()).default([]),
});

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error:"Unauthorized" }, {status:401});
  if (!db) return NextResponse.json({ conversations: [] });
  const rows = await db.select().from(conversations).where(eq(conversations.organizationId, session.organizationId)).orderBy(desc(conversations.updatedAt));
  const result:any[]=[];
  for (const c of rows) {
    const members = await db.select({ userId: conversationMembers.userId, role: conversationMembers.role, lastReadAt: conversationMembers.lastReadAt, name: users.name, email: users.email })
      .from(conversationMembers).innerJoin(users,eq(users.id,conversationMembers.userId))
      .where(eq(conversationMembers.conversationId,c.id));
    const me = members.find(m=>m.userId===session.id);
    if (!me) continue;
    const unreadRows = await db.select({id:messages.id}).from(messages).where(eq(messages.conversationId,c.id));
    let unread=me.lastReadAt ? 0 : unreadRows.length;
    const other = members.filter(m=>m.userId!==session.id);
    result.push({ ...c, unreadCount: unread, memberCount: members.length, members: other.map(m=>({id:m.userId,name:m.name,email:m.email,role:m.role})) });
  }
  // Accurate unread counts are calculated separately with SQL-safe timestamp filtering below.
  for (const item of result) {
    const me = await db.select({lastReadAt:conversationMembers.lastReadAt}).from(conversationMembers).where(and(eq(conversationMembers.conversationId,item.id),eq(conversationMembers.userId,session.id))).limit(1);
    const lr=me[0]?.lastReadAt;
    const all = await db.select({senderId:messages.senderId,createdAt:messages.createdAt}).from(messages).where(eq(messages.conversationId,item.id));
    item.unreadCount = all.filter(m=>m.senderId!==session.id && (!lr || new Date(m.createdAt).getTime()>new Date(lr).getTime())).length;
  }
  return NextResponse.json({ conversations: result });
}

export async function POST(req: Request) {
  const session=await getSession(); if(!session)return NextResponse.json({error:"Unauthorized"},{status:401});
  if(!db)return NextResponse.json({error:"Database not configured"},{status:500});
  if(!(await hasPermission(session,"chat.create")))return NextResponse.json({error:"Forbidden"},{status:403});
  const parsed=createSchema.safeParse(await req.json().catch(()=>null)); if(!parsed.success)return NextResponse.json({error:"Validation failed"},{status:422});
  const input=parsed.data;
  const requestedIds = Array.from(new Set([session.id, ...input.memberIds]));
  const validUsers = await db.select({ id: users.id }).from(users).where(and(eq(users.organizationId, session.organizationId), eq(users.status, "ACTIVE"), inArray(users.id, requestedIds)));
  if (validUsers.length !== requestedIds.length) return NextResponse.json({ error: "One or more members are not active members of this organization" }, { status: 422 });
  if (input.type === "DIRECT" && requestedIds.length !== 2) return NextResponse.json({ error: "A direct conversation must contain exactly two members" }, { status: 422 });
  if ((input.type === "GROUP" || input.type === "SPACE") && requestedIds.length < 2) return NextResponse.json({ error: "A group or space needs at least two members" }, { status: 422 });
  if(input.type === "DIRECT") {
    const candidates=await db.select({id:conversations.id}).from(conversations).where(and(eq(conversations.organizationId,session.organizationId),eq(conversations.type,"DIRECT")));
    for(const c of candidates){
      const ms=await db.select({userId:conversationMembers.userId}).from(conversationMembers).where(eq(conversationMembers.conversationId,c.id));
      const ids=ms.map(x=>x.userId).sort();
      if(ids.length===2 && ids.join('|')===requestedIds.slice().sort().join('|')) return NextResponse.json({conversation:c,existing:true});
    }
  }
  const [c]=await db.insert(conversations).values({organizationId:session.organizationId,type:input.type,name:input.name??null,description:input.description??null,createdBy:session.id}).returning();
  await db.insert(conversationMembers).values(requestedIds.map(userId=>({conversationId:c.id,userId,lastReadAt:new Date()}))).onConflictDoNothing();
  return NextResponse.json({conversation:c},{status:201});
}
