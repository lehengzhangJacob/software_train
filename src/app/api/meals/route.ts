import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getTodayStr } from "@/lib/utils"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const userId = Number(searchParams.get("userId")) || 1
  const date = searchParams.get("date") || getTodayStr()

  const records = await prisma.mealRecord.findMany({
    where: { userId, recordDate: date },
    orderBy: [{ recordTime: "asc" }],
  })

  return NextResponse.json({ data: records })
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const record = await prisma.mealRecord.create({
      data: {
        userId: body.userId || 1,
        foodName: body.foodName,
        mealType: body.mealType,
        calories: body.calories,
        proteinG: body.proteinG ?? 0,
        fatG: body.fatG ?? 0,
        carbsG: body.carbsG ?? 0,
        portionDesc: body.portionDesc ?? null,
        photoPath: body.photoPath ?? null,
        recognitionRaw: body.recognitionRaw ?? null,
        recordDate: body.recordDate || getTodayStr(),
        recordTime: body.recordTime || new Date().toTimeString().slice(0, 8),
        notes: body.notes ?? null,
      },
    })
    return NextResponse.json({ data: record })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { recordId, ...data } = body
    const record = await prisma.mealRecord.update({
      where: { recordId },
      data,
    })
    return NextResponse.json({ data: record })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const recordId = Number(searchParams.get("id"))
  if (!recordId) return NextResponse.json({ error: "Missing id" }, { status: 400 })

  await prisma.mealRecord.delete({ where: { recordId } })
  return NextResponse.json({ data: { deleted: true } })
}
