import { NextResponse } from "next/server"
import { z } from "zod"
import { getSession } from "@/lib/admin-auth"
import { supabase } from "@/lib/supabase"

const PolicyAction = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create_draft"), reason: z.string().min(8).max(500) }),
  z.object({ action: z.literal("publish"), reason: z.string().min(8).max(500) }),
  z.object({ action: z.literal("update_draft"), reason: z.string().min(8).max(500), partnerTypes: z.array(z.enum(["REFERRAL", "CHANNEL", "IMPLEMENTATION", "TECHNOLOGY", "PAYMENT"])).min(1), trackCriteria: z.record(z.enum(["REFERRAL", "CHANNEL", "IMPLEMENTATION", "TECHNOLOGY", "PAYMENT"]), z.object({ silverOutcomes: z.number().int().min(1).max(1000), goldOutcomes: z.number().int().min(2).max(1000), platinumOutcomes: z.number().int().min(3).max(1000), silverMinDays: z.number().int().min(0).max(3650), goldMinDays: z.number().int().min(0).max(3650), platinumMinDays: z.number().int().min(0).max(3650), assessmentWindowDays: z.number().int().min(1).max(3650) })).refine((criteria) => Object.keys(criteria).length === 5, "Configure all five Partner Type tracks") }),
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
  if (parsed.data.action === "create_draft") {
    const { data: existingDraft, error: draftError } = await supabase.from("partner_grading_policies")
      .select("*").eq("status", "DRAFT").order("created_at", { ascending: false }).limit(1).maybeSingle()
    if (draftError) return NextResponse.json({ error: "Could not load the current policy draft" }, { status: 500 })
    if (existingDraft) return NextResponse.json({ ok: true, policy: existingDraft, alreadyExists: true })

    const { data: current, error: currentError } = await supabase.from("partner_grading_policies")
      .select("*").eq("status", "APPROVED").order("effective_at", { ascending: false }).limit(1).maybeSingle()
    if (currentError) return NextResponse.json({ error: "Could not load the current approved policy" }, { status: 500 })
    if (!current) return NextResponse.json({ error: "No approved policy exists to revise" }, { status: 404 })

    const versionMatch = String(current.version || "1.0").match(/^(\d+)(?:\.(\d+))?$/)
    if (!versionMatch) return NextResponse.json({ error: "The current policy version is invalid" }, { status: 409 })
    const nextVersion = `${Number(versionMatch[1]) + 1}.0`
    let criteria = current.criteria && typeof current.criteria === "object" ? current.criteria as Record<string, unknown> : {}
    if (typeof current.criteria === "string") {
      try { criteria = JSON.parse(current.criteria) as Record<string, unknown> } catch { criteria = {} }
    }
    const defaultTrackCriteria = {
      silverOutcomes: Number(current.silver_outcomes || 1),
      goldOutcomes: Number(current.gold_outcomes || 10),
      platinumOutcomes: Number(current.platinum_outcomes || 25),
      silverMinDays: Number(current.silver_min_days ?? 90),
      goldMinDays: Number(current.gold_min_days ?? 183),
      platinumMinDays: Number(current.platinum_min_days ?? 365),
      assessmentWindowDays: Number(current.rolling_window_days || 365),
    }
    const existingTrackCriteria = criteria.trackCriteria && typeof criteria.trackCriteria === "object"
      ? criteria.trackCriteria as Record<string, Record<string, unknown>>
      : {}
    criteria = {
      ...criteria,
      partnerTypes: ["REFERRAL", "CHANNEL", "IMPLEMENTATION", "TECHNOLOGY", "PAYMENT"],
      trackCriteria: Object.fromEntries(["REFERRAL", "CHANNEL", "IMPLEMENTATION", "TECHNOLOGY", "PAYMENT"].map((type) => [
        type,
        { ...defaultTrackCriteria, ...(existingTrackCriteria[type] || {}) },
      ])),
      requirements: Array.isArray(criteria.requirements) ? criteria.requirements : ["completed onboarding", "applicable certification", "satisfactory customer outcomes", "satisfactory compliance", "management approval", "performance review"],
    }
    const { data: draft, error: insertError } = await supabase.from("partner_grading_policies").insert({
      policy_reference: current.policy_reference || "MP-POL-PGP-001",
      version: nextVersion,
      status: "DRAFT",
      silver_outcomes: current.silver_outcomes,
      gold_outcomes: current.gold_outcomes,
      platinum_outcomes: current.platinum_outcomes,
      silver_min_days: current.silver_min_days,
      gold_min_days: current.gold_min_days,
      platinum_min_days: current.platinum_min_days,
      rolling_window_days: current.rolling_window_days,
      criteria,
      created_by: session.userId,
      approval_reason: "",
    }).select("*").single()
    if (insertError || !draft) return NextResponse.json({ error: "Could not create the next policy revision" }, { status: 500 })
    const { error: auditError } = await supabase.from("partner_grading_policy_changes").insert({
      policy_id: draft.id,
      previous_values: { version: current.version, status: current.status },
      new_values: { version: nextVersion, status: "DRAFT" },
      change_reason: parsed.data.reason,
      changed_by: session.userId,
    })
    if (auditError) return NextResponse.json({ error: "Draft created, but its audit record could not be saved" }, { status: 500 })
    return NextResponse.json({ ok: true, policy: draft })
  }
  const { data: policy } = await supabase.from("partner_grading_policies").select("id,status,version").eq("status", "DRAFT").order("created_at", { ascending: false }).limit(1).maybeSingle()
  if (!policy) return NextResponse.json({ error: "No draft grading policy is available" }, { status: 404 })
  if (parsed.data.action === "update_draft") {
    for (const [type, values] of Object.entries(parsed.data.trackCriteria)) {
      if (values.goldOutcomes <= values.silverOutcomes || values.platinumOutcomes <= values.goldOutcomes || values.goldMinDays < values.silverMinDays || values.platinumMinDays < values.goldMinDays) return NextResponse.json({ error: `Higher grades must require more outcomes and no shorter duration in the ${type} track` }, { status: 400 })
    }
    const channel = parsed.data.trackCriteria.CHANNEL
    const values = { silver_outcomes: channel.silverOutcomes, gold_outcomes: channel.goldOutcomes, platinum_outcomes: channel.platinumOutcomes, silver_min_days: channel.silverMinDays, gold_min_days: channel.goldMinDays, platinum_min_days: channel.platinumMinDays }
    const { data: previous } = await supabase.from("partner_grading_policies").select("criteria,silver_outcomes,gold_outcomes,platinum_outcomes,silver_min_days,gold_min_days,platinum_min_days").eq("id", policy.id).maybeSingle()
    const criteria = { partnerTypes: parsed.data.partnerTypes, trackCriteria: parsed.data.trackCriteria, requirements: ["completed onboarding", "applicable certification", "satisfactory customer outcomes", "satisfactory compliance", "management approval", "performance review"] }
    const { error } = await supabase.from("partner_grading_policies").update({ ...values, criteria, updated_at: new Date().toISOString() }).eq("id", policy.id).eq("status", "DRAFT")
    if (error) return NextResponse.json({ error: "Could not update the draft policy" }, { status: 500 })
    await supabase.from("partner_grading_policy_changes").insert({ policy_id: policy.id, previous_values: previous || {}, new_values: { ...values, criteria }, change_reason: parsed.data.reason, changed_by: session.userId })
    return NextResponse.json({ ok: true, values: { ...values, criteria } })
  }
  const effectiveAt = new Date().toISOString()
  const approvingOfficer = String(session.name || session.username || "").trim()
  if (!approvingOfficer) return NextResponse.json({ error: "The approving Admin must have a recorded name before publication" }, { status: 409 })
  const { data: priorApprovals } = await supabase.from("partner_grading_policies").select("id").eq("status", "APPROVED")
  const { error } = await supabase.from("partner_grading_policies").update({
    status: "APPROVED",
    effective_at: effectiveAt,
    approved_at: effectiveAt,
    approved_by: session.userId,
    approved_by_name: approvingOfficer,
    approval_reason: parsed.data.reason,
    updated_at: effectiveAt,
  }).eq("id", policy.id).eq("status", "DRAFT")
  if (error) return NextResponse.json({ error: "Could not publish grading policy" }, { status: 500 })
  const priorIds = (priorApprovals || []).map((row) => row.id).filter((id) => id !== policy.id)
  if (priorIds.length) await supabase.from("partner_grading_policies").update({ status: "SUPERSEDED", updated_at: effectiveAt }).in("id", priorIds)
  const { data: partners } = await supabase.from("partners").select("id").eq("status", "ACTIVE")
  if (partners?.length) await supabase.from("partner_notifications").insert(partners.map((p) => ({
    partner_id: p.id, type: "grading_policy_published", title: "New Partner Performance Policy",
    body: `Policy v${policy.version || "1.0"} is effective from ${effectiveAt}. Review and acknowledge it in Partner Portal Resources. ${parsed.data.reason}`,
    link: "/partner/resources", source_type: "partner_grading_policy", source_id: policy.id, created_at: effectiveAt,
  })))
  return NextResponse.json({ ok: true, effectiveAt })
}
