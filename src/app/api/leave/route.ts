import { NextResponse } from "next/server";
import { and, eq, desc, inArray } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { db } from "@/db";
import { leaveRequests, users } from "@/db/schema";
import { logActivity } from "@/services/activity/activity.service";

export async function GET() {
  const session = await getSession(); if (!session) return NextResponse.json({error:"Unauthorized"},{status:401});
  if (!db) return NextResponse.json({requests:[]});
  if (!(session.role === "SUPER_ADMIN" || await hasPermission(session,"leave.view"))) return NextResponse.json({error:"Forbidden"},{status:403});
  let ids:string[]=[session.id];
  if (session.role === "SUPER_ADMIN" || session.role === "HR_MANAGER") ids=(await db.select({id:users.id}).from(users).where(eq(users.organizationId,session.organizationId))).map(x=>x.id);
  else if (session.role === "MANAGER") ids=[session.id,...(await db.select({id:users.id}).from(users).where(and(eq(users.organizationId,session.organizationId),eq(users.reportingManagerId,session.id)))).map(x=>x.id)];
  const rows=await db.select({request:leaveRequests,userName:users.name,userEmail:users.email}).from(leaveRequests).innerJoin(users,eq(users.id,leaveRequests.userId)).where(and(eq(leaveRequests.organizationId,session.organizationId),inArray(leaveRequests.userId,ids))).orderBy(desc(leaveRequests.createdAt));
  return NextResponse.json({requests:rows});
}
export async function POST(req:Request){
 const s=await getSession(); if(!s)return NextResponse.json({error:"Unauthorized"},{status:401}); if(!db)return NextResponse.json({error:"Database not configured"},{status:500});
 const b=await req.json().catch(()=>null); if(!b?.type||!b?.startDate||!b?.endDate||!b?.reason)return NextResponse.json({error:"type, startDate, endDate and reason are required"},{status:422});
 const start=new Date(b.startDate),end=new Date(b.endDate),days=Math.floor((end.getTime()-start.getTime())/86400000)+1;if(days<1)return NextResponse.json({error:"Invalid date range"},{status:422});
 const [created]=await db.insert(leaveRequests).values({organizationId:s.organizationId,userId:s.id,type:b.type,startDate:b.startDate,endDate:b.endDate,days,reason:b.reason}).returning();
 await logActivity({organizationId:s.organizationId,userId:s.id,action:"LEAVE_REQUESTED",entityType:"leave_request",entityId:created.id,metadata:{days,type:b.type}}); return NextResponse.json({request:created},{status:201});
}
export async function PATCH(req:Request){
 const s=await getSession();if(!s)return NextResponse.json({error:"Unauthorized"},{status:401});if(!db)return NextResponse.json({error:"Database not configured"},{status:500});
 if(!(s.role==="SUPER_ADMIN"||await hasPermission(s,"leave.approve")))return NextResponse.json({error:"Forbidden"},{status:403});
 const b=await req.json().catch(()=>null);if(!b?.id||!["APPROVED","REJECTED"].includes(b.status))return NextResponse.json({error:"id and valid status required"},{status:422});
 const [existing]=await db.select().from(leaveRequests).where(and(eq(leaveRequests.id,b.id),eq(leaveRequests.organizationId,s.organizationId)));if(!existing)return NextResponse.json({error:"Not found"},{status:404});
 const [updated]=await db.update(leaveRequests).set({status:b.status,reviewedBy:s.id,reviewNote:b.note??null,updatedAt:new Date()}).where(eq(leaveRequests.id,b.id)).returning();
 await logActivity({organizationId:s.organizationId,userId:s.id,action:`LEAVE_${b.status}`,entityType:"leave_request",entityId:b.id,metadata:{employeeId:existing.userId}});return NextResponse.json({request:updated});
}
