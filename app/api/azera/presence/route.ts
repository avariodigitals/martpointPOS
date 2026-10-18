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
    .select("user_id, queues, is_online, last_seen_at")
    .eq("is_online", true)

  if (error) return NextResponse.json({ error: "Failed to load agent presence" }, { status: 500 })
  const online = data || []
  const own = await supabase.from("azera_agent_presence").select("user_id, queues, is_online, last_seen_at").eq("user_id", current.userId).maybeSingle()
  return NextResponse.json({ agent: own.data || null, online })
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
    return NextResponse.json({ agent: data })
  } catch {
    return NextResponse.json({ error: "Could not update agent presence" }, { status: 400 })
  }
}
