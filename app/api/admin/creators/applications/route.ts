import { NextResponse } from "next/server"
import { authorizeAdmin } from "@/lib/admin-auth"
import { listCreatorApplicationsPage } from "@/lib/creator-applications"
import { isCreatorReplyFilter } from "@/lib/creator-question-summary"
import { CREATOR_APPLICATION_STATUSES } from "@/lib/creator-constants"
import type { CreatorApplicationStatus } from "@/lib/creator-constants"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const { denied } = await authorizeAdmin("creator.view")
  if (denied) return denied

  const url = new URL(request.url)
  const status = url.searchParams.get("status")
  const validStatus = CREATOR_APPLICATION_STATUSES.includes(status as CreatorApplicationStatus)
    ? (status as CreatorApplicationStatus)
    : null

  const response = url.searchParams.get("response")
  if (response && !isCreatorReplyFilter(response)) return NextResponse.json({ error: "Invalid reply filter" }, { status: 400 })
  const page = Math.max(1, Math.min(100000, Number.parseInt(url.searchParams.get("page") || "1", 10) || 1))
  try {
  const result = await listCreatorApplicationsPage({
    status: validStatus,
    state: url.searchParams.get("state"),
    q: url.searchParams.get("q"),
    response: isCreatorReplyFilter(response) ? response : null,
  }, page, 25)
  return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } })
  } catch (error) {
    console.error("[creator applications] tracking load failed", error)
    return NextResponse.json({ error: "Could not load applications. Please retry." }, { status: 503 })
  }
}
