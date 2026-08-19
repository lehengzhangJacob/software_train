import { NextResponse, type NextRequest } from "next/server"

import {
  ACCESS_COOKIE,
  accessGateEnabled,
  decideAccess,
} from "@/lib/access/gate"

// Account-session gate for the cloud instance. When AUTH_REQUIRED is unset the
// gate is disabled and local development keeps its compatibility fallback.
export async function middleware(request: NextRequest) {
  if (!accessGateEnabled()) return NextResponse.next()

  const hasSession = Boolean(request.cookies.get(ACCESS_COOKIE)?.value)
  const decision = decideAccess(request.nextUrl.pathname, hasSession, true)

  if (decision === "allow") return NextResponse.next()
  if (decision === "unauthorized-api") {
    return NextResponse.json({ data: null, error: "unauthorized" }, { status: 401 })
  }
  const target = request.nextUrl.clone()
  target.pathname = "/access"
  target.search = ""
  return NextResponse.redirect(target)
}

export const config = {
  // The access page itself is public, as are the small presentation assets it uses.
  // Keep those assets outside the redirect branch so the gate never turns an
  // image request into an HTML response.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon|brand|images/nutrition/meal-hero\\.webp).*)"],
}
