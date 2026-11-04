import { NextResponse } from "next/server"
import { getSession, hasPermissionForUser } from "@/lib/admin-auth"
import { isSupabaseConfigured, supabase } from "@/lib/supabase"

const TYPES = ["lead", "business", "creator", "creator_application", "team", "user", "conversation"] as const
export async function GET(request: Request) {
  const session = await getSession()
  if (!session || !await hasPermissionForUser(session.userId, session.role, "azera")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Call notes are temporarily unavailable." }, { status: 503 })
  const params = new URL(request.url).searchParams
  const entityType = params.get("entityType") || ""
  const entityId = params.get("entityId") || ""
  if (!(TYPES as readonly string[]).includes(entityType) || !entityId || entityId.length > 200) return NextResponse.json({ error: "Choose a valid note destination." }, { status: 400 })
  const { data, error } = await supabase.from("azera_call_summary_links")
    .select("id,entity_type,entity_id,entity_label,created_at,azera_call_summaries(id,call_id,summary,transcript,action_items,outcome,summary_status,summary_source,author_name,created_at,azera_calls(customer_name,customer_phone,agent_name,agent_user_id,direction,status))")
    .eq("entity_type", entityType).eq("entity_id", entityId).order("created_at", { ascending: false }).limit(100)
  if (error) return NextResponse.json({ error: "Could not load linked call notes. Apply migration 170 and retry." }, { status: 503 })
  return NextResponse.json({ notes: data || [] }, { headers: { "Cache-Control": "private, no-store" } })
}
