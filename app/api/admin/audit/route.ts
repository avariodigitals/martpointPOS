import { NextResponse } from "next/server"
import { getSession } from "@/lib/admin-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"

const SENSITIVE_KEYS = ["password", "token", "secret", "cookie", "api_key", "session", "card", "cvv"]

function sanitiseMetadata(metadata: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!metadata) return null
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(metadata)) {
    if (SENSITIVE_KEYS.some((k) => key.toLowerCase().includes(k))) {
      out[key] = "[REDACTED]"
    } else {
      out[key] = value
    }
  }
  return out
}

export async function GET(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const { searchParams } = new URL(request.url)
    const actorType = searchParams.get("actorType")
    const action = searchParams.get("action")
    const entityType = searchParams.get("entityType")
    const entityId = searchParams.get("entityId")
    const from = searchParams.get("from")
    const to = searchParams.get("to")
    const limit = Math.min(parseInt(searchParams.get("limit") || "100"), 500)

    if (!isSupabaseConfigured()) return NextResponse.json({ events: [] })

    let q = supabase
      .from("finance_audit_events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit)

    if (actorType) q = q.eq("actor_type", actorType)
    if (action) q = q.ilike("action", `%${action}%`)
    if (entityType) q = q.eq("entity_type", entityType)
    if (entityId) q = q.eq("entity_id", entityId)
    if (from) q = q.gte("created_at", new Date(from).toISOString())
    if (to) q = q.lte("created_at", new Date(to).toISOString())

    const { data, error } = await q
    if (error) throw new Error(error.message)

    const events = ((data as any[]) || []).map((e) => ({
      ...e,
      metadata: sanitiseMetadata(e.metadata),
    }))

    return NextResponse.json({ success: true, events })
  } catch (e) {
    console.error("[admin/audit] GET", e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
