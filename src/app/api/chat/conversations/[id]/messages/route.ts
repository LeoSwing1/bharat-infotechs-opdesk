import { NextResponse } from "next/server";
import { and, eq, asc, desc } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { conversationMembers, messages, conversations, users } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { createNotification } from "@/services/notifications/notification.service";

const schema=z.object({body:z.string().trim().min(1).max(10000),type:z.enum(["TEXT","FILE"]).default("TEXT"),attachmentUrl:z.string().url().optional()});

async function membership(conversationId:string,userId:string){
  if(!db)return null;
  const [row]=await db.select({id:conversationMembers.id}).from(conversationMembers).where(and(eq(conversationMembers.conversationId,conversationId),eq(conversationMembers.userId,userId))).limit(1);
  return row ?? null;
}

export async function GET(_:Request,{params}:{params:Promise<{id:string}>}){
  const session=await getSession();if(!session)return NextResponse.json({error:"Unauthorized"},{status:401});if(!db)return NextResponse.json({messages:[]});
  const {id}=await params; if(!(await membership(id,session.id)))return NextResponse.json({error:"Forbidden"},{status:403});
  const rows=await db.select({id:messages.id,conversationId:messages.conversationId,senderId:messages.senderId,senderName:users.name,type:messages.type,body:messages.body,attachmentUrl:messages.attachmentUrl,createdAt:messages.createdAt,editedAt:messages.editedAt})
    .from(messages).innerJoin(users,eq(users.id,messages.senderId)).where(eq(messages.conversationId,id)).orderBy(asc(messages.createdAt));
  await db.update(conversationMembers).set({lastReadAt:new Date()}).where(and(eq(conversationMembers.conversationId,id),eq(conversationMembers.userId,session.id)));
  return NextResponse.json({messages:rows});
}

export async function PATCH(_:Request,{params}:{params:Promise<{id:string}>}){
  const session=await getSession();if(!session)return NextResponse.json({error:"Unauthorized"},{status:401});if(!db)return NextResponse.json({error:"Database not configured"},{status:500});
  const {id}=await params;if(!(await membership(id,session.id)))return NextResponse.json({error:"Forbidden"},{status:403});
  await db.update(conversationMembers).set({lastReadAt:new Date()}).where(and(eq(conversationMembers.conversationId,id),eq(conversationMembers.userId,session.id)));
  return NextResponse.json({ok:true});
}

export async function POST(req:Request,{params}:{params:Promise<{id:string}>}){
  const session=await getSession();if(!session)return NextResponse.json({error:"Unauthorized"},{status:401});if(!db)return NextResponse.json({error:"Database not configured"},{status:500});if(!(await hasPermission(session,"chat.message")))return NextResponse.json({error:"Forbidden"},{status:403});
  const {id}=await params;if(!(await membership(id,session.id)))return NextResponse.json({error:"Forbidden"},{status:403});
  const [conversation]=await db.select({id:conversations.id}).from(conversations).where(and(eq(conversations.id,id),eq(conversations.organizationId,session.organizationId)));if(!conversation)return NextResponse.json({error:"Not found"},{status:404});
  const parsed=schema.safeParse(await req.json().catch(()=>null));if(!parsed.success)return NextResponse.json({error:"Validation failed"},{status:422});
  const [message]=await db.insert(messages).values({conversationId:id,senderId:session.id,type:parsed.data.type,body:parsed.data.body,attachmentUrl:parsed.data.attachmentUrl??null}).returning();
  const now=new Date();await db.update(conversations).set({updatedAt:now}).where(eq(conversations.id,id));
  await db.update(conversationMembers).set({lastReadAt:now}).where(and(eq(conversationMembers.conversationId,id),eq(conversationMembers.userId,session.id)));
  const members = await db.select({ userId: conversationMembers.userId }).from(conversationMembers).where(eq(conversationMembers.conversationId,id));
  const recipients = members.filter(m => m.userId !== session.id);
  await Promise.all(recipients.map(r => createNotification({organizationId:session.organizationId,userId:r.userId,type:"CHAT_MESSAGE",title:"New message",message:`${session.name}: ${parsed.data.body.slice(0,120)}`,link:`/chat?conversation=${id}`,dedupeKey:`chat-message:${message.id}:${r.userId}`})));
  return NextResponse.json({message},{status:201});
}
