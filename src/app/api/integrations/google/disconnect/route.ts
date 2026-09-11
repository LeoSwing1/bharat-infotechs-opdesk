import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { disconnect } from "@/services/integrations/google-connection.service";
import { logActivity } from "@/services/activity/activity.service";

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (process.env.DEMO_MODE === "true") {
    return NextResponse.json({ error: "Not available in demo mode" }, { status: 400 });
  }

  await disconnect(session.id);

  await logActivity({
    organizationId: session.organizationId, userId: session.id,
    action: "GOOGLE_CALENDAR_DISCONNECTED", entityType: "integration",
  });

  return NextResponse.json({ ok: true });
}
