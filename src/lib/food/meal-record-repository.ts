import "server-only"

import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import type { MealCreateInput } from "@/lib/validation"

const mealRecordSelect = {
  recordId: true,
  userId: true,
  foodName: true,
  mealType: true,
  calories: true,
  proteinG: true,
  fatG: true,
  carbsG: true,
  portionDesc: true,
  recordDate: true,
  recordTime: true,
  notes: true,
  createdAt: true,
} satisfies Prisma.MealRecordSelect

type MealRecordRow = Prisma.MealRecordGetPayload<{ select: typeof mealRecordSelect }>

export type MealRecordView = {
  recordId: number
  userId: number
  foodName: string
  mealType: string
  calories: number
  proteinG: number
  fatG: number
  carbsG: number
  portionDesc: string | null
  recordDate: string
  recordTime: string
  notes: string | null
  createdAt: string
}

function toMealRecordView(row: MealRecordRow): MealRecordView {
  return {
    recordId: row.recordId,
    userId: row.userId,
    foodName: row.foodName,
    mealType: row.mealType,
    calories: row.calories,
    proteinG: row.proteinG,
    fatG: row.fatG,
    carbsG: row.carbsG,
    portionDesc: row.portionDesc,
    recordDate: row.recordDate,
    recordTime: row.recordTime,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
  }
}

export type SaveAgentMealRecordInput = {
  userId: number
  payload: MealCreateInput
}

export async function saveAgentMealRecord(input: SaveAgentMealRecordInput) {
  const row = await prisma.mealRecord.create({
    data: {
      userId: input.userId,
      ...input.payload,
    },
    select: mealRecordSelect,
  })
  return toMealRecordView(row)
}

export async function getOwnedMealRecord(userId: number, recordId: number) {
  const row = await prisma.mealRecord.findFirst({
    where: { userId, recordId },
    select: mealRecordSelect,
  })
  return row ? toMealRecordView(row) : null
}
