import { NextResponse } from "next/server"
import { getSession } from "@/lib/admin-auth"
import { globalSearch } from "@/lib/global-search"

export async function GET(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const q = searchParams.get("q") || ""

  try {
    const results = await globalSearch(q)
    return NextResponse.json({ success: true, results })
  } catch (e) {
    console.error("[admin/search]", e)
    return NextResponse.json({ error: "Search failed" }, { status: 500 })
  }
}
