import "server-only"

import { cookies } from "next/headers"
import type { Prisma, PrismaClient } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import { createSessionToken, digestToken } from "@/lib/auth/crypto"

export const AUTH_COOKIE = "ft_session"
export const AUTH_SESSION_MAX_AGE = 60 * 60 * 24 * 30

type AuthDb = PrismaClient | Prisma.TransactionClient

export class AuthFailure extends Error {
  status: number

  constructor(message: string, status = 401) {
    super(message)
    this.name = "AuthFailure"
    this.status = status
  }
}

export interface PublicAuthProfile {
  userId: number
  username: string
  login: string
}

export interface AuthenticatedIdentity extends PublicAuthProfile {
  accountId: number
}

function toPublicProfile(profile: { userId: number; username: string }, login: string): PublicAuthProfile {
  return { userId: profile.userId, username: profile.username, login }
}

function toAuthenticatedIdentity(
  session: { account: { accountId: number; login: string; profile: { userId: number; username: string } } },
): AuthenticatedIdentity {
  return {
    accountId: session.account.accountId,
    ...toPublicProfile(session.account.profile, session.account.login),
  }
}

export function getBootstrapInviteCode(): string {
  return (process.env.AUTH_BOOTSTRAP_INVITE_CODE ?? process.env.APP_ACCESS_TOKEN ?? "").trim()
}

export async function ensureBootstrapInvite(client: AuthDb = prisma) {
  const rawCode = getBootstrapInviteCode()
  if (!rawCode) return null

  const digest = digestToken(rawCode)
  const maxUses = Math.max(1, Number.parseInt(process.env.AUTH_BOOTSTRAP_INVITE_MAX_USES ?? "20", 10) || 20)
  return client.inviteCode.upsert({
    where: { codeDigest: digest },
    update: { active: true, maxUses },
    create: { codeDigest: digest, label: "bootstrap", maxUses },
  })
}

export async function createSessionRecord(client: AuthDb, accountId: number) {
  const token = createSessionToken()
  const expiresAt = new Date(Date.now() + AUTH_SESSION_MAX_AGE * 1000)
  await client.authSession.create({
    data: {
      accountId,
      tokenDigest: digestToken(token),
      expiresAt,
    },
  })
  return { token, expiresAt }
}

export async function findSession(token: string | null | undefined) {
  if (!token) return null
  const digest = digestToken(token)
  const session = await prisma.authSession.findUnique({
    where: { tokenDigest: digest },
    select: {
      sessionId: true,
      expiresAt: true,
      account: {
        select: {
          accountId: true,
          login: true,
          status: true,
          profile: true,
        },
      },
    },
  })

  if (!session || session.account.status !== "active" || session.expiresAt <= new Date()) {
    if (session) await prisma.authSession.deleteMany({ where: { sessionId: session.sessionId } })
    return null
  }

  return session
}

export async function getSessionToken(): Promise<string | null> {
  return (await cookies()).get(AUTH_COOKIE)?.value ?? null
}

export async function getAuthenticatedProfile(): Promise<PublicAuthProfile | null> {
  const identity = await getAuthenticatedIdentity()
  if (!identity) return null
  return {
    userId: identity.userId,
    username: identity.username,
    login: identity.login,
  }
}

export async function getAuthenticatedIdentity(): Promise<AuthenticatedIdentity | null> {
  const session = await findSession(await getSessionToken())
  return session ? toAuthenticatedIdentity(session) : null
}

export async function setSessionCookie(token: string) {
  const jar = await cookies()
  jar.set(AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: AUTH_SESSION_MAX_AGE,
  })
}

export async function clearSessionCookie() {
  const jar = await cookies()
  jar.set(AUTH_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  })
}

export async function deleteSession(token: string | null | undefined) {
  if (!token) return
  await prisma.authSession.deleteMany({ where: { tokenDigest: digestToken(token) } })
}

export function publicProfile(profile: { userId: number; username: string }, login: string): PublicAuthProfile {
  return toPublicProfile(profile, login)
}
