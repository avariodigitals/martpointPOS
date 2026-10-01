import { NextResponse } from "next/server"
import { authorizeAdmin } from "@/lib/admin-auth"
import { listCreators } from "@/lib/creator-applications"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const { denied } = await authorizeAdmin("creator.view")
  if (denied) return denied
  const url = new URL(request.url)
  const creators = await listCreators({
    status: url.searchParams.get("status"),
    state: url.searchParams.get("state"),
    q: url.searchParams.get("q"),
  })
  return NextResponse.json({ creators })
}
