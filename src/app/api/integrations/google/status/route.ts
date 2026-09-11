import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { googleCalendarConfigured } from "@/services/integrations/google-calendar";
import { isConnected } from "@/services/integrations/google-connection.service";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (process.env.DEMO_MODE === "true") {
    return NextResponse.json({ configured: googleCalendarConfigured(), connected: false });
  }

  return NextResponse.json({
    configured: googleCalendarConfigured(),
    connected: await isConnected(session.id),
  });
}
