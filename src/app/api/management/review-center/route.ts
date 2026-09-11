import { NextResponse } from "next/server";
import { and, eq, inArray, sql } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { db } from "@/db";
import { users, tasks, dailyUpdates, leaveRequests, warnings, warningApprovals, qualityScores } from "@/db/schema";
export async function GET(){
 const s=await getSession(); if(!s)return NextResponse.json({error:"Unauthorized"},{status:401}); if(!db)return NextResponse.json({available:false});
 if(!["SUPER_ADMIN","HR_MANAGER","MANAGER","TEAM_LEAD"].includes(s.role))return NextResponse.json({error:"Forbidden"},{status:403});
 let ids:string[]=[s.id];
 if(s.role==="SUPER_ADMIN"||s.role==="HR_MANAGER") ids=(await db.select({id:users.id}).from(users).where(and(eq(users.organizationId,s.organizationId),eq(users.status,"ACTIVE")))).map(x=>x.id);
 else ids=[s.id,...(await db.select({id:users.id}).from(users).where(and(eq(users.organizationId,s.organizationId),eq(users.reportingManagerId,s.id),eq(users.status,"ACTIVE")))).map(x=>x.id)];
 const today=new Date().toISOString().slice(0,10); const open=["ASSIGNED","STARTED","SUBMITTED","UNDER_REVIEW","REJECTED"] as const;
 const [people,missingUpdates,openTasks,overdueTasks,pendingLeave,openWarnings,pendingWarningApprovals,avgQuality]=await Promise.all([
  db.select({id:users.id,name:users.name,role:users.role}).from(users).where(and(eq(users.organizationId,s.organizationId),inArray(users.id,ids))),
  db.select({id:users.id,name:users.name}).from(users).where(and(eq(users.organizationId,s.organizationId),inArray(users.id,ids),eq(users.status,"ACTIVE"),sql`NOT EXISTS (SELECT 1 FROM daily_updates du WHERE du.user_id = ${users.id} AND du.organization_id = ${s.organizationId} AND du.update_date = ${today})`)),
  db.select({count:sql<number>`count(*)`.mapWith(Number)}).from(tasks).where(and(eq(tasks.organizationId,s.organizationId),inArray(tasks.assigneeId,ids),inArray(tasks.status,open))),
  db.select({count:sql<number>`count(*)`.mapWith(Number)}).from(tasks).where(and(eq(tasks.organizationId,s.organizationId),inArray(tasks.assigneeId,ids),inArray(tasks.status,open),sql`${tasks.deadline}<now()`)),
  db.select({count:sql<number>`count(*)`.mapWith(Number)}).from(leaveRequests).where(and(eq(leaveRequests.organizationId,s.organizationId),inArray(leaveRequests.userId,ids),eq(leaveRequests.status,"PENDING"))),
  db.select({count:sql<number>`count(*)`.mapWith(Number)}).from(warnings).where(and(eq(warnings.organizationId,s.organizationId),inArray(warnings.userId,ids),inArray(warnings.status,["OPEN","ACKNOWLEDGED"]))),
  db.select({count:sql<number>`count(*)`.mapWith(Number)}).from(warningApprovals).where(and(eq(warningApprovals.organizationId,s.organizationId),eq(warningApprovals.approverId,s.id),eq(warningApprovals.status,"PENDING"))),
  db.select({avg:sql<number>`coalesce(round(avg(${qualityScores.score})),0)`.mapWith(Number)}).from(qualityScores).where(and(eq(qualityScores.organizationId,s.organizationId),inArray(qualityScores.userId,ids)))
 ]);
 return NextResponse.json({scope:s.role,people,compliance:{missingDailyUpdates:missingUpdates,openTasks:openTasks[0]?.count??0,overdueTasks:overdueTasks[0]?.count??0,pendingLeave:pendingLeave[0]?.count??0,openWarnings:openWarnings[0]?.count??0,pendingWarningApprovals:pendingWarningApprovals[0]?.count??0,averageQuality:avgQuality[0]?.avg??0}});
}
