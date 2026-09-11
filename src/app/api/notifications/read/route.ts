import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth";
import {
  markNotificationAsRead,
} from "@/services/notifications/notification.service";

export async function POST(request: Request) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const body = await request.json().catch(() => null);

  const notificationId =
    typeof body?.notificationId === "string"
      ? body.notificationId
      : "";

  if (!notificationId) {
    return NextResponse.json(
      {
        error: "notificationId is required",
      },
      { status: 400 }
    );
  }

  const result =
    await markNotificationAsRead({
      notificationId,
      userId: session.id,
    });

  if (result.status === "NOT_FOUND") {
    return NextResponse.json(
      {
        error: "Notification not found",
      },
      { status: 404 }
    );
  }

  return NextResponse.json(result);
}