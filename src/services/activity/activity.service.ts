import { db } from "@/db";
import { activityLogs } from "@/db/schema";

export async function logActivity(input: {
  organizationId:string; userId?:string; action:string; entityType?:string; entityId?:string; metadata?:unknown
}) {
  if (!db) return;
  await db.insert(activityLogs).values({ ...input, metadata: input.metadata as any });
}
