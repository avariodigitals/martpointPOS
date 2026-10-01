import { NextResponse } from "next/server"
import { authorizeAdmin } from "@/lib/admin-auth"
import { getCreatorNetworkStats } from "@/lib/creator-applications"
import { getLearningAnalytics } from "@/lib/creator-analytics"

export const dynamic = "force-dynamic"

export async function GET() {
  const { denied } = await authorizeAdmin("creator.view")
  if (denied) return denied
  const [stats, learning] = await Promise.all([getCreatorNetworkStats(), getLearningAnalytics()])
  return NextResponse.json({ ...stats, learning })
}
