import { NextResponse } from "next/server"
import { authorizeAdmin } from "@/lib/admin-auth"
import { canAccessMailbox, getMailbox, syncSharedMailbox } from "@/lib/admin-mailbox"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, denied } = await authorizeAdmin("mailbox")
  if (denied) return denied
  const { id } = await params
  try {
    if (!(await canAccessMailbox(id, session.userId, session.role === "Admin"))) return NextResponse.json({ error: "You do not have access to this mailbox." }, { status: 403 })
    const mailbox = await getMailbox(id)
    if (!mailbox) return NextResponse.json({ error: "Mailbox not found." }, { status: 404 })
    const result = await syncSharedMailbox(mailbox)
    if (result.error) return NextResponse.json(result, { status: 502 })
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Mailbox sync failed." }, { status: 500 })
  }
}
