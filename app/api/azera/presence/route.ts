import { NextResponse } from "next/server"
import { getSession, hasPermission } from "@/lib/admin-auth"
import type { SessionPayload, UserRole } from "@/lib/admin-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"

const QUEUES = ["sales", "support", "customer_support"] as const
type Queue = (typeof QUEUES)[number]

async function session(): Promise<SessionPayload | null> {
  const value = await getSession()
  return value && hasPermission(value.role as UserRole, "azera") ? value : null
}

export async function GET() {
  const current = await session()
  if (!current) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  if (!isSupabaseConfigured()) return NextResponse.json({ agent: null, online: [] })

  const { data, error } = await supabase
    .from("azera_agent_presence")
    .select("user_id, queues, is_online, last_seen_at, users(name,role,status)")
    .eq("is_online", true)
    .gte("last_seen_at", new Date(Date.now() - 90_000).toISOString())

  if (error) return NextResponse.json({ error: "Failed to load agent presence" }, { status: 500 })
  const online = (data || []).flatMap(row => {
    const user = Array.isArray(row.users) ? row.users[0] : row.users
    return user?.status === "ACTIVE" && hasPermission(user.role as UserRole, "azera") ? [{ user_id: row.user_id, name: user.name, queues: row.queues, is_online: row.is_online, last_seen_at: row.last_seen_at }] : []
  })
  const own = await supabase.from("azera_agent_presence").select("user_id, queues, is_online, last_seen_at").eq("user_id", current.userId).maybeSingle()
  const agent = own.data ? { ...own.data, is_online: own.data.is_online && Date.parse(own.data.last_seen_at) > Date.now() - 90_000 } : null
  return NextResponse.json({ userId: current.userId, agent, online }, { headers: { "Cache-Control": "no-store" } })
}

export async function POST(request: Request) {
  const current = await session()
  if (!current) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 })

  try {
    const body = await request.json()
    const isOnline = body.online === true
    const queues = Array.isArray(body.queues)
      ? body.queues.filter((queue: unknown): queue is Queue => typeof queue === "string" && QUEUES.includes(queue as Queue))
      : ["customer_support"]
    const safeQueues = queues.length ? queues : ["customer_support"]
    const { data, error } = await supabase
      .from("azera_agent_presence")
      .upsert({ user_id: current.userId, queues: safeQueues, is_online: isOnline, last_seen_at: new Date().toISOString(), updated_at: new Date().toISOString() }, { onConflict: "user_id" })
      .select("user_id, queues, is_online, last_seen_at")
      .single()
    if (error) return NextResponse.json({ error: "Could not update agent presence" }, { status: 500 })
    if (isOnline) {
      const { data: waiting } = await supabase.from("azera_conversations").select("id").is("assigned_admin_user_id", null)
        .eq("waiting_for_agent", true).neq("status", "closed").in("queue", safeQueues).order("last_message_at", { ascending: true }).limit(20)
      for (const conversation of waiting || []) await supabase.rpc("azera_assign_waiting_conversation", { p_conversation_id: conversation.id })
    }
    return NextResponse.json({ agent: data })
  } catch {
    return NextResponse.json({ error: "Could not update agent presence" }, { status: 400 })
  }
}
