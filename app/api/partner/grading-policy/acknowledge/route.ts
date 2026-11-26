import { NextResponse } from "next/server"
import { requirePartnerSession } from "@/lib/partner-auth"
import { supabase } from "@/lib/supabase"

export async function POST() {
  const session = await requirePartnerSession()
  const { data: policy } = await supabase.from("partner_grading_policies").select("id,version").eq("status", "APPROVED").order("effective_at", { ascending: false }).limit(1).maybeSingle()
  if (!policy) return NextResponse.json({ error: "The grading policy has not been approved yet." }, { status: 409 })
  const { error } = await supabase.from("partner_grading_policy_acknowledgements").upsert({
    partner_id: session.partnerId, policy_id: policy.id, partner_user_id: session.partnerUserId, acknowledged_at: new Date().toISOString(),
  }, { onConflict: "partner_id,policy_id" })
  if (error) return NextResponse.json({ error: "Could not record the acknowledgement" }, { status: 500 })
  return NextResponse.json({ ok: true, version: policy.version })
}
