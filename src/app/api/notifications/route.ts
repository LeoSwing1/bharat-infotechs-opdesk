import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth";
import {
  createNotification,
  getUserNotifications,
} from "@/services/notifications/notification.service";

export async function GET(request: Request) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);

  const unreadOnly =
    searchParams.get("unreadOnly") === "true";

  const limitValue = Number(
    searchParams.get("limit") || "30"
  );

  const limit = Number.isFinite(limitValue)
    ? Math.min(Math.max(limitValue, 1), 100)
    : 30;

  const notifications = await getUserNotifications({
    userId: session.id,
    limit,
    unreadOnly,
  });

  return NextResponse.json({
    ok: true,
    notifications,
  });
}

export async function POST(request: Request) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const body = await request.json().catch(() => null);

  if (!body) {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }

  /*
   * This endpoint is intentionally restricted to
   * server-side/system notification creation.
   *
   * For now, only allow creating a notification
   * for the currently authenticated user.
   */

  const title =
    typeof body.title === "string"
      ? body.title.trim()
      : "";

  const message =
    typeof body.message === "string"
      ? body.message.trim()
      : "";

  const type =
    typeof body.type === "string"
      ? body.type
      : "SYSTEM";

  if (!title || !message) {
    return NextResponse.json(
      {
        error: "Title and message are required",
      },
      { status: 400 }
    );
  }

  const result = await createNotification({
    organizationId: session.organizationId,
    userId: session.id,
    type,
    title,
    message,
    link:
      typeof body.link === "string"
        ? body.link
        : undefined,
    dedupeKey:
      typeof body.dedupeKey === "string"
        ? body.dedupeKey
        : undefined,
  });

  return NextResponse.json(result);
}