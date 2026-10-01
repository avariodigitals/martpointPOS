import { NextResponse } from "next/server"
import { authorizeAdmin } from "@/lib/admin-auth"
import { getCreatorNetworkStats } from "@/lib/creator-applications"

export const dynamic = "force-dynamic"

export async function GET() {
  const { denied } = await authorizeAdmin("creator.view")
  if (denied) return denied
  const stats = await getCreatorNetworkStats()
  return NextResponse.json(stats)
}
