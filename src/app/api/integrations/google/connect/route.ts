import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { buildGoogleOAuthUrl, googleCalendarConfigured } from "@/services/integrations/google-calendar";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error:"Unauthorized" }, { status:401 });
  if (!googleCalendarConfigured()) return NextResponse.json({ configured:false });
  return NextResponse.redirect(buildGoogleOAuthUrl(session.id));
}
