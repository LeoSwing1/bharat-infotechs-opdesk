import { eq } from "drizzle-orm";
import { db } from "@/db";
import { googleCalendarConnections } from "@/db/schema";
import { encryptToken, decryptToken } from "./token-crypto";
import { refreshAccessToken } from "./google-calendar";

export async function saveConnection(userId: string, tokens: { accessToken: string; refreshToken: string; expiresIn: number; scope: string }) {
  if (!db) return;
  const expiresAt = new Date(Date.now() + tokens.expiresIn * 1000);
  await db.insert(googleCalendarConnections).values({
    userId,
    accessTokenEncrypted: encryptToken(tokens.accessToken),
    refreshTokenEncrypted: encryptToken(tokens.refreshToken),
    expiresAt,
    scope: tokens.scope,
  }).onConflictDoUpdate({
    target: googleCalendarConnections.userId,
    set: {
      accessTokenEncrypted: encryptToken(tokens.accessToken),
      refreshTokenEncrypted: encryptToken(tokens.refreshToken),
      expiresAt,
      scope: tokens.scope,
    },
  });
}

export async function isConnected(userId: string): Promise<boolean> {
  if (!db) return false;
  const [row] = await db.select({ id: googleCalendarConnections.id }).from(googleCalendarConnections).where(eq(googleCalendarConnections.userId, userId));
  return Boolean(row);
}

export async function disconnect(userId: string): Promise<void> {
  if (!db) return;
  await db.delete(googleCalendarConnections).where(eq(googleCalendarConnections.userId, userId));
}

/**
 * Returns a valid (non-expired) access token for this user, refreshing it
 * first if needed. Returns null if the user hasn't connected Google
 * Calendar — callers should treat that as "skip calendar sync", not an error.
 */
export async function getValidAccessToken(userId: string): Promise<string | null> {
  if (!db) return null;
  const [row] = await db.select().from(googleCalendarConnections).where(eq(googleCalendarConnections.userId, userId));
  if (!row) return null;

  // Refresh a little early (60s buffer) rather than right at the boundary.
  if (new Date(row.expiresAt).getTime() - 60_000 > Date.now()) {
    return decryptToken(row.accessTokenEncrypted);
  }

  const refreshToken = decryptToken(row.refreshTokenEncrypted);
  const refreshed = await refreshAccessToken(refreshToken);
  await db.update(googleCalendarConnections).set({
    accessTokenEncrypted: encryptToken(refreshed.accessToken),
    expiresAt: new Date(Date.now() + refreshed.expiresIn * 1000),
  }).where(eq(googleCalendarConnections.userId, userId));

  return refreshed.accessToken;
}
