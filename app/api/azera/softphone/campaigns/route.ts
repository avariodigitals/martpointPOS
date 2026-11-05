import { NextResponse } from "next/server"
import { getSession, hasPermissionForUser } from "@/lib/admin-auth"
import { isSupabaseConfigured, supabase } from "@/lib/supabase"
import { resolveCampaignBusinessId } from "@/lib/azera-campaigns"

export const dynamic = "force-dynamic"
const queues = ["sales", "support", "onboarding", "customer_support"]

export async function GET() {
  const session = await getSession()
  if (!session || !await hasPermissionForUser(session.userId, session.role, "azera"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Campaigns are unavailable." }, { status: 503 })
  try {
    const businessId = await resolveCampaignBusinessId()
    if (!businessId) return NextResponse.json({ campaigns: [] }, { headers: { "Cache-Control": "private, no-store" } })
    const { data: assignment, error: assignmentError } = await supabase.from("azera_voice_agent_assignments")
      .select("queues,enabled").eq("business_id", businessId).eq("user_id", session.userId).eq("enabled", true).maybeSingle()
    if (assignmentError) return NextResponse.json({ error: "Could not check campaign assignment." }, { status: 503 })
    const selectedQueues = Array.isArray(assignment?.queues)
      ? [...new Set(assignment.queues.filter((queue: unknown): queue is string => typeof queue === "string" && queues.includes(queue)))]
      : []
    const userFilter = `assigned_user_id.eq.${session.userId}`
    const filter = selectedQueues.length
      ? `${userFilter},assigned_queue.in.(${selectedQueues.join(",")})`
      : userFilter
    const { data, error } = await supabase.from("azera_call_campaigns")
      .select("id,name,purpose,status,target_count,created_at,assigned_queue")
      .eq("business_id", businessId).or(filter).order("created_at", { ascending: false }).limit(30)
    if (error) return NextResponse.json({ error: "Could not load your campaigns." }, { status: 503 })
    return NextResponse.json({ campaigns: data || [] }, { headers: { "Cache-Control": "private, no-store" } })
  } catch {
    return NextResponse.json({ error: "Could not load your campaigns." }, { status: 503 })
  }
}
