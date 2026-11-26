import { NextResponse } from "next/server"
import { z } from "zod"
import { getSession } from "@/lib/admin-auth"
import { supabase } from "@/lib/supabase"

const PolicyAction = z.discriminatedUnion("action", [
  z.object({ action: z.literal("publish"), reason: z.string().min(8) }),
  z.object({ action: z.literal("update_draft"), reason: z.string().min(8), silverOutcomes: z.number().int().min(1).max(1000), goldOutcomes: z.number().int().min(2).max(1000), platinumOutcomes: z.number().int().min(3).max(1000), silverMinDays: z.number().int().min(0).max(3650), goldMinDays: z.number().int().min(0).max(3650), platinumMinDays: z.number().int().min(0).max(3650) }),
])
export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.role !== "Admin") return NextResponse.json({ error: "Management access required" }, { status: 403 })
  const { data } = await supabase.from("partner_grading_policies").select("*").order("created_at", { ascending: false }).limit(10)
  return NextResponse.json({ policies: data || [] })
}

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.role !== "Admin") return NextResponse.json({ error: "Management access required" }, { status: 403 })
  const parsed = PolicyAction.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: "A publication reason is required" }, { status: 400 })
  const { data: policy } = await supabase.from("partner_grading_policies").select("id,status").eq("status", "DRAFT").order("created_at", { ascending: false }).limit(1).maybeSingle()
  if (!policy) return NextResponse.json({ error: "No draft grading policy is available" }, { status: 404 })
  if (parsed.data.action === "update_draft") {
    const values = { silver_outcomes: parsed.data.silverOutcomes, gold_outcomes: parsed.data.goldOutcomes, platinum_outcomes: parsed.data.platinumOutcomes, silver_min_days: parsed.data.silverMinDays, gold_min_days: parsed.data.goldMinDays, platinum_min_days: parsed.data.platinumMinDays }
    if (values.gold_outcomes <= values.silver_outcomes || values.platinum_outcomes <= values.gold_outcomes || values.gold_min_days < values.silver_min_days || values.platinum_min_days < values.gold_min_days) return NextResponse.json({ error: "Higher grades must require more outcomes and no shorter duration than lower grades" }, { status: 400 })
    const { data: previous } = await supabase.from("partner_grading_policies").select("silver_outcomes,gold_outcomes,platinum_outcomes,silver_min_days,gold_min_days,platinum_min_days").eq("id", policy.id).maybeSingle()
    const { error } = await supabase.from("partner_grading_policies").update({ ...values, updated_at: new Date().toISOString() }).eq("id", policy.id).eq("status", "DRAFT")
    if (error) return NextResponse.json({ error: "Could not update the draft policy" }, { status: 500 })
    await supabase.from("partner_grading_policy_changes").insert({ policy_id: policy.id, previous_values: previous || {}, new_values: values, change_reason: parsed.data.reason, changed_by: session.userId })
    return NextResponse.json({ ok: true, values })
  }
  const effectiveAt = new Date().toISOString()
  const { error } = await supabase.from("partner_grading_policies").update({ status: "APPROVED", effective_at: effectiveAt, approved_by: session.userId, approval_reason: parsed.data.reason, updated_at: effectiveAt }).eq("id", policy.id).eq("status", "DRAFT")
  if (error) return NextResponse.json({ error: "Could not publish grading policy" }, { status: 500 })
  const { data: partners } = await supabase.from("partners").select("id").eq("status", "ACTIVE")
  if (partners?.length) await supabase.from("partner_notifications").insert(partners.map((p) => ({
    partner_id: p.id, type: "grading_policy_published", title: "New Partner Performance Policy",
    body: `Policy v1.0 is effective from ${effectiveAt}. Review it in Partner Portal Resources. ${parsed.data.reason}`,
    link: "/partner/resources", source_type: "partner_grading_policy", source_id: policy.id, created_at: effectiveAt,
  })))
  return NextResponse.json({ ok: true, effectiveAt })
}
