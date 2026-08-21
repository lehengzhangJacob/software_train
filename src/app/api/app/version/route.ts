import { NextResponse } from "next/server"

import { getAppVersion } from "@/lib/app-version"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export function GET() {
  return NextResponse.json(
    { data: getAppVersion(), error: null },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    },
  )
}
