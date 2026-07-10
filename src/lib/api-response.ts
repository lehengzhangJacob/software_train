import { NextResponse } from "next/server"

export interface ApiEnvelope<T> {
  data: T | null
  error: string | null
}

export function apiSuccess<T>(data: T, status = 200) {
  return NextResponse.json<ApiEnvelope<T>>({ data, error: null }, { status })
}

export function apiError(error: string, status: number) {
  return NextResponse.json<ApiEnvelope<never>>({ data: null, error }, { status })
}
