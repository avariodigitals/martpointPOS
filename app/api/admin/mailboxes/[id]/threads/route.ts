import { NextResponse } from "next/server"
import { authorizeAdmin } from "@/lib/admin-auth"
import { canAccessMailbox } from "@/lib/admin-mailbox"
import { supabase } from "@/lib/supabase"

export const dynamic = "force-dynamic"

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, denied } = await authorizeAdmin("mailbox")
  if (denied) return denied
  const { id } = await params
  try {
    if (!(await canAccessMailbox(id, session.userId, session.role === "Admin"))) return NextResponse.json({ error: "You do not have access to this mailbox." }, { status: 403 })
    const url = new URL(request.url)
    const folder = url.searchParams.get("folder") || "inbox"
    const query = (url.searchParams.get("q") || "").trim().toLowerCase()
    let threadQuery = supabase.from("admin_mailbox_threads").select("*").eq("mailbox_id", id).order("last_message_at", { ascending: false }).limit(500)
    threadQuery = folder === "deleted" ? threadQuery.eq("status", "deleted") : threadQuery.neq("status", "deleted")
    const { data, error } = await threadQuery
    if (error) throw new Error(error.message)
    const threadIds = (data || []).map((thread) => thread.id)
    const [states, lastMessages, labelLinks] = threadIds.length ? await Promise.all([
      supabase.from("admin_mailbox_thread_state").select("thread_id,is_read").eq("user_id", session.userId).in("thread_id", threadIds),
      supabase.from("admin_mailbox_messages").select("thread_id,direction").in("thread_id", threadIds).order("created_at", { ascending: false }),
      supabase.from("admin_mailbox_thread_labels").select("thread_id,label:admin_mailbox_labels(id,name,color)").in("thread_id", threadIds),
    ]) : [{ data: [], error: null }, { data: [], error: null }, { data: [], error: null }]
    if (states.error || lastMessages.error || labelLinks.error) throw new Error(states.error?.message || lastMessages.error?.message || labelLinks.error?.message)
    const readMap = new Map((states.data || []).map((state) => [state.thread_id, state.is_read]))
    const latestDirection = new Map<string, string>()
    for (const item of lastMessages.data || []) if (!latestDirection.has(item.thread_id)) latestDirection.set(item.thread_id, item.direction)
    const labelsByThread = new Map<string, { id: string; name: string; color: string }[]>()
    for (const item of labelLinks.data || []) {
      if (!item.label) continue
      const labels = Array.isArray(item.label) ? item.label : [item.label]
      labelsByThread.set(item.thread_id, [...(labelsByThread.get(item.thread_id) || []), ...labels])
    }
    const result = (data || []).map((thread) => ({
      id: thread.id,
      mailbox_id: thread.mailbox_id,
      subject: thread.subject,
      participants: thread.participants || [],
      status: thread.status,
      is_starred: thread.is_starred,
      assigned_to: thread.assigned_to,
      last_message_at: thread.last_message_at,
      last_message_preview: thread.last_message_preview,
      unread: readMap.get(thread.id) === false,
      last_direction: latestDirection.get(thread.id) || "inbound",
      labels: labelsByThread.get(thread.id) || [],
    })).filter((thread) => {
      if (folder === "starred" && !thread.is_starred) return false
      if (folder === "closed" && thread.status !== "closed") return false
      if (folder === "inbox" && thread.status !== "open") return false
      if (folder === "sent" && thread.last_direction !== "outbound") return false
      if (folder !== "closed" && thread.status === "closed") return false
      if (folder === "assigned" && thread.assigned_to !== session.userId) return false
      return !query || `${thread.subject} ${thread.last_message_preview} ${thread.participants.join(" ")}`.toLowerCase().includes(query)
    })
    return NextResponse.json({ threads: result })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not load conversations." }, { status: 500 })
  }
}
