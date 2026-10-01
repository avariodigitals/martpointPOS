import { NextResponse } from "next/server"
import { z } from "zod"
import { authorizeAdmin } from "@/lib/admin-auth"
import { reorderLearning } from "@/lib/creator-learning"

export const dynamic = "force-dynamic"

const schema = z.object({ orderedIds: z.array(z.string().uuid()).min(1) })

export async function POST(request: Request) {
  const { denied } = await authorizeAdmin("creator.learning.manage")
  if (denied) return denied
  try {
    const { orderedIds } = schema.parse(await request.json())
    const { error } = await reorderLearning(orderedIds)
    if (error) return NextResponse.json({ error }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 })
  }
}
