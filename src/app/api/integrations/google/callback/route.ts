import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { exchangeCodeForTokens } from "@/services/integrations/google-calendar";
import { saveConnection } from "@/services/integrations/google-connection.service";
import { logActivity } from "@/services/activity/activity.service";

export async function GET(req: Request) {
  const session = await getSession();
  const url = new URL(req.url);
  const settingsUrl = new URL("/settings/organization", url.origin);

  if (!session) {
    settingsUrl.searchParams.set("google", "unauthorized");
    return NextResponse.redirect(settingsUrl);
  }

  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  if (error || !code) {
    settingsUrl.searchParams.set("google", "denied");
    return NextResponse.redirect(settingsUrl);
  }

  // The `state` param carries the user ID that initiated the OAuth flow —
  // confirm it matches the currently logged-in session before trusting the
  // callback, so one user's browser can't complete another user's flow.
  const state = url.searchParams.get("state");
  if (state !== session.id) {
    settingsUrl.searchParams.set("google", "state_mismatch");
    return NextResponse.redirect(settingsUrl);
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    if (!tokens.refresh_token) {
      // Google only returns a refresh_token on first consent (or with
      // prompt=consent, which buildGoogleOAuthUrl always sets) — if it's
      // still missing something is misconfigured upstream.
      settingsUrl.searchParams.set("google", "no_refresh_token");
      return NextResponse.redirect(settingsUrl);
    }

    await saveConnection(session.id, {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresIn: tokens.expires_in,
      scope: tokens.scope,
    });

    await logActivity({
      organizationId: session.organizationId, userId: session.id,
      action: "GOOGLE_CALENDAR_CONNECTED", entityType: "integration",
    });

    settingsUrl.searchParams.set("google", "connected");
    return NextResponse.redirect(settingsUrl);
  } catch (err) {
    console.error("Google Calendar OAuth callback failed:", err);
    settingsUrl.searchParams.set("google", "error");
    return NextResponse.redirect(settingsUrl);
  }
}
