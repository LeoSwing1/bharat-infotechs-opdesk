import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies, headers } from "next/headers";

const COOKIE = "opsdesk_session";
const secret = () => new TextEncoder().encode(process.env.AUTH_SECRET || "dev-only-secret-change-me");

export type SessionUser = { id: string; organizationId: string; name: string; email: string; role: string };

/**
 * Creates a session token and sets it as an HttpOnly cookie for the web app.
 * Returns the raw token string as well, so API clients that can't rely on
 * cookies (e.g. the Flutter app) can store it and send it back as
 * `Authorization: Bearer <token>` on every request instead.
 */
export async function createSession(user: SessionUser): Promise<string> {
  const token = await new SignJWT(user).setProtectedHeader({ alg: "HS256" }).setIssuedAt()
    .setExpirationTime(`${Number(process.env.SESSION_MAX_AGE_DAYS || 7)}d`).sign(secret());
  (await cookies()).set(COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" });
  return token;
}

async function verifySessionToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    if (!payload.id || !payload.organizationId || !payload.role) return null;
    return payload as unknown as SessionUser;
  } catch { return null; }
}

/**
 * Resolves the current session from either the web session cookie or an
 * `Authorization: Bearer <token>` header — the same signed token works for
 * both, so the web app and the Flutter app share one auth mechanism.
 */
export async function getSession(): Promise<SessionUser | null> {
  const cookieToken = (await cookies()).get(COOKIE)?.value;
  if (cookieToken) {
    const user = await verifySessionToken(cookieToken);
    if (user) return user;
  }

  const authHeader = (await headers()).get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return verifySessionToken(authHeader.slice(7).trim());
  }

  return null;
}

export async function destroySession() {
  (await cookies()).set(COOKIE, "", { httpOnly: true, expires: new Date(0), path: "/" });
}
