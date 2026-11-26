import { NextResponse } from "next/server"
import { getSession } from "@/lib/admin-auth"

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  return NextResponse.json({ error: "The legacy single-grade rubric is retired. Use the separate Channel and Implementation performance review." }, { status: 410 })
}

export async function POST() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  return NextResponse.json({ error: "The legacy single-grade rubric is retired. Use the separate Channel and Implementation performance review." }, { status: 410 })
}
