import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth";
import {
  getUnreadNotificationCount,
} from "@/services/notifications/notification.service";

export async function GET() {
  const session = await getSession();

  if (!session) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const count =
    await getUnreadNotificationCount(session.id);

  return NextResponse.json({
    ok: true,
    count,
  });
}