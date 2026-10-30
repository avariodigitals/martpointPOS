import { NextResponse } from "next/server"
import { authorizeAdmin, getAllUsers } from "@/lib/admin-auth"
import { supabase } from "@/lib/supabase"
import { listMailboxesForUser } from "@/lib/admin-mailbox"
import { sanitizeSupportHtml } from "@/lib/support-html"

export const dynamic = "force-dynamic"

// Rich signatures can contain inline logo/banner data URIs. Keep a generous
// limit so those images are not silently truncated into broken markup.
const MAX_SIGNATURE_LENGTH = 1_000_000

export async function GET(request: Request) {
  const { session, denied } = await authorizeAdmin("mailbox")
  if (denied) return denied
  try {
    const isAdmin = session.role === "Admin"
    const mailboxes = await listMailboxesForUser(session.userId, isAdmin)
    const requestedMailboxId = new URL(request.url).searchParams.get("mailboxId")
    let settings = null
    let memberIds: string[] = []
    if (requestedMailboxId) {
      if (!mailboxes.some((mailbox) => mailbox.id === requestedMailboxId)) return NextResponse.json({ error: "You do not have access to this mailbox." }, { status: 403 })
      if (await canManage(requestedMailboxId, session.userId, isAdmin)) {
        const { data, error } = await supabase.from("admin_mailboxes").select("id,name,email,imap_host,imap_port,imap_secure,imap_user,imap_folder,signature_html,signature_format,active,last_sync_at,last_sync_error").eq("id", requestedMailboxId).maybeSingle()
        const memberResult = await supabase.from("admin_mailbox_members").select("user_id").eq("mailbox_id", requestedMailboxId)
        if (error || memberResult.error || !data) throw new Error(error?.message || memberResult.error?.message || "Mailbox not found.")
        settings = data
        memberIds = (memberResult.data || []).map((item) => item.user_id)
      }
    }
    const memberships = await supabase.from("admin_mailbox_members").select("mailbox_id,user_id,can_manage").eq("user_id", session.userId)
    const mailboxIds = mailboxes.map((item) => item.id)
    const counts = mailboxIds.length ? await supabase.from("admin_mailbox_members").select("mailbox_id").in("mailbox_id", mailboxIds) : { data: [], error: null }
    if (memberships.error || counts.error) throw new Error(memberships.error?.message || counts.error?.message)
    const roles = new Map((memberships.data || []).map((item) => [item.mailbox_id, item.can_manage]))
    const memberCounts = new Map<string, number>()
    for (const item of counts.data || []) memberCounts.set(item.mailbox_id, (memberCounts.get(item.mailbox_id) || 0) + 1)
    const rosterMailboxId = requestedMailboxId && mailboxes.some((item) => item.id === requestedMailboxId) ? requestedMailboxId : mailboxes[0]?.id
    const rosterMemberships = rosterMailboxId ? await supabase.from("admin_mailbox_members").select("user_id").eq("mailbox_id", rosterMailboxId) : { data: [], error: null }
    if (rosterMemberships.error) throw new Error(rosterMemberships.error.message)
    const rosterIds = new Set((rosterMemberships.data || []).map((item) => item.user_id))
    const users = (await getAllUsers()).filter((user) => user.status === "ACTIVE" && rosterIds.has(user.id)).map(({ id, name, email, username, role }) => ({ id, name, email, username, role }))
    return NextResponse.json({ mailboxes: mailboxes.map((mailbox) => ({ ...mailbox, canManage: isAdmin || Boolean(roles.get(mailbox.id)), memberCount: memberCounts.get(mailbox.id) || 0 })), users, settings, memberIds, isAdmin })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not load mailboxes." }, { status: 500 })
  }
}

async function canManage(mailboxId: string, userId: string, isAdmin: boolean) {
  if (isAdmin) return true
  const { data, error } = await supabase.from("admin_mailbox_members").select("can_manage").eq("mailbox_id", mailboxId).eq("user_id", userId).maybeSingle()
  if (error) throw new Error(error.message)
  return Boolean(data?.can_manage)
}

export async function POST(request: Request) {
  const { session, denied } = await authorizeAdmin("mailbox")
  if (denied) return denied
  if (session.role !== "Admin") return NextResponse.json({ error: "Only an Admin can configure shared mailboxes." }, { status: 403 })
  try {
    const body = await request.json()
    const email = String(body.email || "").trim().toLowerCase()
    const name = String(body.name || "").trim()
    const host = String(body.imapHost || "").trim()
    const username = String(body.imapUser || "").trim()
    const password = String(body.imapPassword || "")
    const members = Array.isArray(body.members) ? [...new Set(body.members.map(String))] : []
    if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !host || !username || !password) {
      return NextResponse.json({ error: "Name, valid inbox address, IMAP host/login/password are required." }, { status: 400 })
    }
    const activeUsers = (await getAllUsers()).filter((user) => user.status === "ACTIVE")
    const activeUserIds = new Set(activeUsers.map((user) => user.id))
    const requestedMembers = members.filter((userId) => activeUserIds.has(userId))
    const signatureFormat = body.signatureFormat === "plain" ? "plain" : "html"
    const signatureValue = String(body.signatureHtml || "")
    const { data: mailbox, error } = await supabase.from("admin_mailboxes").insert({
      name, email, imap_host: host, imap_port: Number(body.imapPort) || 993,
      imap_secure: body.imapSecure !== false, imap_user: username, imap_password: password,
      imap_folder: String(body.imapFolder || "INBOX").trim() || "INBOX",
      signature_html: signatureFormat === "html" ? sanitizeSupportHtml(signatureValue.slice(0, MAX_SIGNATURE_LENGTH)) : signatureValue.slice(0, MAX_SIGNATURE_LENGTH),
      signature_format: signatureFormat,
      created_by: session.userId,
    }).select("id,name,email,active,created_at").single()
    if (error || !mailbox) throw new Error(error?.message || "Mailbox could not be created.")
    const { error: membershipError } = await supabase.from("admin_mailbox_members").insert([...new Set([session.userId, ...requestedMembers])].map((user_id) => ({ mailbox_id: mailbox.id, user_id, can_manage: user_id === session.userId })))
    if (membershipError) {
      await supabase.from("admin_mailboxes").delete().eq("id", mailbox.id)
      throw new Error(membershipError.message)
    }
    return NextResponse.json({ success: true, mailbox })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not create mailbox." }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  const { session, denied } = await authorizeAdmin("mailbox")
  if (denied) return denied
  try {
    const body = await request.json()
    const id = String(body.id || "")
    if (!id || !(await canManage(id, session.userId, session.role === "Admin"))) return NextResponse.json({ error: "Mailbox manager access is required." }, { status: 403 })
    if (Array.isArray(body.members)) {
      if (session.role !== "Admin") return NextResponse.json({ error: "Only an Admin can change mailbox membership." }, { status: 403 })
      const users = (await getAllUsers()).filter((user) => user.status === "ACTIVE")
      const requested = [...new Set(body.members.map(String))].filter((userId: string) => users.some((user) => user.id === userId))
      if (!requested.length) return NextResponse.json({ error: "A mailbox must have at least one active member." }, { status: 400 })
      const { error: saveError } = await supabase.from("admin_mailbox_members").upsert(requested.map((user_id: string) => ({ mailbox_id: id, user_id, can_manage: user_id === session.userId })), { onConflict: "mailbox_id,user_id" })
      if (saveError) throw new Error(saveError.message)
      const { data: current, error: currentError } = await supabase.from("admin_mailbox_members").select("user_id").eq("mailbox_id", id)
      if (currentError) throw new Error(currentError.message)
      const obsolete = (current || []).map((membership) => membership.user_id).filter((userId) => !requested.includes(userId))
      for (const userId of obsolete) {
        const { error } = await supabase.from("admin_mailbox_members").delete().eq("mailbox_id", id).eq("user_id", userId)
        if (error) throw new Error(error.message)
      }
    }
    const fields: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (typeof body.active === "boolean") fields.active = body.active
    if (typeof body.imapPassword === "string" && body.imapPassword) fields.imap_password = body.imapPassword
    if (typeof body.name === "string" && body.name.trim()) fields.name = body.name.trim()
    if (typeof body.imapHost === "string") fields.imap_host = body.imapHost.trim()
    if (typeof body.imapUser === "string") fields.imap_user = body.imapUser.trim()
    if (typeof body.imapPort === "number") fields.imap_port = body.imapPort
    if (typeof body.imapFolder === "string") fields.imap_folder = body.imapFolder.trim() || "INBOX"
    if (typeof body.imapSecure === "boolean") fields.imap_secure = body.imapSecure
    if (typeof body.signatureHtml === "string") {
      const signatureFormat = body.signatureFormat === "plain" ? "plain" : body.signatureFormat === "html" ? "html" : null
      if (signatureFormat) fields.signature_format = signatureFormat
      const signatureHtml = body.signatureHtml.slice(0, MAX_SIGNATURE_LENGTH)
      fields.signature_html = signatureFormat === "plain" ? signatureHtml : sanitizeSupportHtml(signatureHtml)
    }
    const { error } = await supabase.from("admin_mailboxes").update(fields).eq("id", id)
    if (error) throw new Error(error.message)
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not update mailbox." }, { status: 500 })
  }
}
