import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth";
import {
  markAllNotificationsAsRead,
} from "@/services/notifications/notification.service";

export async function POST() {
  const session = await getSession();

  if (!session) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const result =
    await markAllNotificationsAsRead(session.id);

  return NextResponse.json(result);
}