import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(req:NextRequest){
  const path=req.nextUrl.pathname;
  const publicPath=path.startsWith("/login") || path.startsWith("/api/auth");
  if(publicPath) return NextResponse.next();
  const token=req.cookies.get("opsdesk_session");
  // Mobile/API clients (e.g. the Flutter app) authenticate with
  // `Authorization: Bearer <token>` instead of the web session cookie.
  // The middleware only needs to know *some* credential is present; actual
  // verification happens in getSession() inside each route handler.
  const hasBearerToken = req.headers.get("authorization")?.startsWith("Bearer ");
  if(!token && !hasBearerToken && !path.startsWith("/_next") && !path.startsWith("/favicon")){
    // API routes must return a clean JSON 401, not an HTML redirect — the
    // Flutter app (and any other API consumer) needs a real status code
    // here, not a 307 pointing at a browser login page.
    if(path.startsWith("/api/")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.redirect(new URL("/login", req.url));
  }
  return NextResponse.next();
}
export const config={matcher:["/((?!_next/static|_next/image|favicon.ico).*)"]};
