import { NextResponse } from "next/server"
import { authorizeAdmin } from "@/lib/admin-auth"
import { listCreatorApplications } from "@/lib/creator-applications"
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

  const applications = await listCreatorApplications({
    status: validStatus,
    state: url.searchParams.get("state"),
    q: url.searchParams.get("q"),
  })
  return NextResponse.json({ applications })
}
