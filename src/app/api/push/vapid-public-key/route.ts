import { NextResponse } from "next/server";
import { pushConfigured } from "@/services/push/push.service";

export async function GET() {
  if (!pushConfigured()) return NextResponse.json({ configured: false });
  return NextResponse.json({ configured: true, publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY });
}
