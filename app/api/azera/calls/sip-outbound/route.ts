import { NextResponse } from "next/server"
import { getSession, hasPermission } from "@/lib/admin-auth"

// The old endpoint dialled a customer's phone without connecting staff audio.
// Do not keep an unbridged, potentially chargeable legacy path available.
export async function POST() {
  const session = await getSession()
  if (!session || !hasPermission(session.role, "azera")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  return NextResponse.json({ error: "Use Call in browser from the Omnichannel conversation. Africa’s Talking now connects the staff browser before calling the contact.", prepareUrl: "/api/azera/calls/africa-browser" }, { status: 409 })
}
