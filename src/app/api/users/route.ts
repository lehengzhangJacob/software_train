import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const user = await prisma.userProfile.findFirst({
    orderBy: { userId: "asc" },
  })
  return NextResponse.json({ data: user ?? null })
}

export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { userId, ...data } = body

    if (!userId) {
      const user = await prisma.userProfile.create({ data })
      return NextResponse.json({ data: user })
    }

    const user = await prisma.userProfile.update({
      where: { userId },
      data,
    })
    return NextResponse.json({ data: user })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
