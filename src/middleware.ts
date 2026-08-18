import { NextResponse, type NextRequest } from "next/server"

import {
  ACCESS_COOKIE,
  accessGateEnabled,
  constantTimeEqualHex,
  decideAccess,
  digestAccessCode,
  getAccessCode,
} from "@/lib/access/gate"

// Public shared-passcode gate for the cloud instance (ADR-0007). When
// APP_ACCESS_TOKEN is unset the gate is disabled and every request passes,
// which keeps the local dev loop byte-for-byte identical.
export async function middleware(request: NextRequest) {
  if (!accessGateEnabled()) return NextResponse.next()

  const cookie = request.cookies.get(ACCESS_COOKIE)?.value ?? ""
  const expected = await digestAccessCode(getAccessCode())
  const authed = constantTimeEqualHex(cookie, expected)
  const decision = decideAccess(request.nextUrl.pathname, authed, true)

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
