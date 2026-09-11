export type CalendarEvent = { title:string; startAt:string; endAt:string; description?:string; meetingLink?:string; attendeeEmails?:string[] };
export function googleCalendarConfigured() {
  return !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET && !!process.env.GOOGLE_REDIRECT_URI;
}
export function buildGoogleOAuthUrl(state:string) {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID || "",
    redirect_uri: process.env.GOOGLE_REDIRECT_URI || "",
    response_type:"code",
    access_type:"offline",
    prompt: "consent", // ensures a refresh_token is returned even on re-connect
    scope:"https://www.googleapis.com/auth/calendar.events",
    state
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

type GoogleTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
};

/** Exchanges an OAuth authorization code for access + refresh tokens. */
export async function exchangeCodeForTokens(code: string): Promise<GoogleTokenResponse> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID || "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
      redirect_uri: process.env.GOOGLE_REDIRECT_URI || "",
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error(`Google token exchange failed: ${res.status} ${await res.text()}`);
  return res.json();
}

/** Uses a stored refresh token to get a fresh access token (Google refresh tokens don't expire on their own). */
export async function refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; expiresIn: number }> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID || "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Google token refresh failed: ${res.status} ${await res.text()}`);
  const data: GoogleTokenResponse = await res.json();
  return { accessToken: data.access_token, expiresIn: data.expires_in };
}

/** Creates an event on the user's primary Google Calendar. Returns the created event's Google ID. */
export async function createGoogleCalendarEvent(accessToken: string, event: CalendarEvent): Promise<string> {
  const res = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({
      summary: event.title,
      description: [event.description, event.meetingLink].filter(Boolean).join("\n\n") || undefined,
      start: { dateTime: event.startAt },
      end: { dateTime: event.endAt },
      attendees: event.attendeeEmails?.map(email => ({ email })),
    }),
  });
  if (!res.ok) throw new Error(`Google Calendar event creation failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.id as string;
}

export async function deleteGoogleCalendarEvent(accessToken: string, googleEventId: string): Promise<void> {
  await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${googleEventId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  // Best-effort: a 404 here just means it was already removed on Google's side.
}
