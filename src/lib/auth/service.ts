import "server-only"

import type { Prisma } from "@prisma/client"

import { ensureAccountSettings } from "@/lib/account/settings"
import { prisma } from "@/lib/prisma"
import { digestToken, hashPassword, normalizeLogin, verifyPassword } from "@/lib/auth/crypto"
import {
  AuthFailure,
  createSessionRecord,
  ensureBootstrapInvite,
  publicProfile,
} from "@/lib/auth/server"
import type { LoginInput, RegisterInput } from "@/lib/auth/validation"

const DEFAULT_PROFILE = {
  gender: "other",
  age: 30,
  heightCm: 170,
  weightKg: 65,
  dailyCalorieTarget: 2000,
  dailyProteinTarget: 60,
  dailyFatTarget: 60,
  dailyCarbsTarget: 250,
  activityLevel: "sedentary",
}

function inviteIsUsable(invite: { active: boolean; usedCount: number; maxUses: number; expiresAt: Date | null }) {
  return invite.active && invite.usedCount < invite.maxUses && (!invite.expiresAt || invite.expiresAt > new Date())
}

export interface AuthResult {
  accountId: number
  token: string
  profile: ReturnType<typeof publicProfile>
}

export async function registerAccount(input: RegisterInput): Promise<AuthResult> {
  await ensureBootstrapInvite()
  const login = normalizeLogin(input.login)
  const codeDigest = digestToken(input.inviteCode)

  const result = await prisma.$transaction(async (tx) => {
    const invite = await tx.inviteCode.findUnique({ where: { codeDigest } })
    if (!invite || !inviteIsUsable(invite)) {
      throw new AuthFailure("娉ㄥ唽閭€璇风爜鏃犳晥鎴栧凡鐢ㄥ敖", 422)
    }

    const existing = await tx.userAccount.findUnique({ where: { login } })
    if (existing) throw new AuthFailure("璇ヨ处鎴峰凡瀛樺湪", 409)

    const unboundProfile = await tx.userProfile.findFirst({
      where: { account: null },
      orderBy: { userId: "asc" },
    })
    const profile = unboundProfile
      ? await tx.userProfile.update({
        where: { userId: unboundProfile.userId },
        data: { username: input.username },
      })
      : await tx.userProfile.create({
        data: {
          username: input.username,
          ...DEFAULT_PROFILE,
          gender: input.gender,
          age: input.age,
          heightCm: input.heightCm,
          weightKg: input.weightKg,
          dailyCalorieTarget: input.dailyCalorieTarget,
          dailyProteinTarget: input.dailyProteinTarget,
          dailyFatTarget: input.dailyFatTarget,
          dailyCarbsTarget: input.dailyCarbsTarget,
          activityLevel: input.activityLevel,
        },
      })

    const consumed = await tx.inviteCode.updateMany({
      where: { inviteId: invite.inviteId, active: true, usedCount: { lt: invite.maxUses } },
      data: { usedCount: { increment: 1 } },
    })
    if (consumed.count !== 1) throw new AuthFailure("娉ㄥ唽閭€璇风爜鏃犳晥鎴栧凡鐢ㄥ敖", 422)

    const account = await tx.userAccount.create({
      data: {
        login,
        passwordHash: hashPassword(input.password),
        profileId: profile.userId,
      },
    })
    const session = await createSessionRecord(tx, account.accountId)
    return { accountId: account.accountId, token: session.token, profile: publicProfile(profile, account.login) }
  })
  await ensureAccountSettings(result.accountId)
  return result
}

export async function loginAccount(input: LoginInput): Promise<AuthResult> {
  const login = normalizeLogin(input.login)
  const account = await prisma.userAccount.findUnique({
    where: { login },
    include: { profile: true },
  })

  if (!account || account.status !== "active" || !verifyPassword(input.password, account.passwordHash)) {
    throw new AuthFailure("璐︽埛鎴栧瘑鐮佷笉姝ｇ‘", 401)
  }

  const session = await createSessionRecord(prisma, account.accountId)
  await ensureAccountSettings(account.accountId)
  return { accountId: account.accountId, token: session.token, profile: publicProfile(account.profile, account.login) }
}

export function toAuthResponse(result: AuthResult) {
  return {
    user: result.profile,
  }
}

export type AuthTransaction = Prisma.TransactionClient
