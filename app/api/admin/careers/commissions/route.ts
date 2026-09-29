import { NextResponse } from "next/server"
import crypto from "crypto"
import { authorizeAdmin } from "@/lib/admin-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { recordAudit, auditContextFromSession, AUDIT_ACTIONS, AUDIT_ENTITIES } from "@/lib/audit"
import {
  listCommissions,
  computeCommission,
  LEAD_SOURCES,
  type CommissionRules,
  type LeadSource,
} from "@/lib/careers-commissions"

export const dynamic = "force-dynamic"

/* GET: commission ledger. Requires careers.commissions.view (Admin/HR/Finance). */
export async function GET(request: Request) {
  const { denied } = await authorizeAdmin("careers.commissions.view")
  if (denied) return denied
  if (!isSupabaseConfigured()) return NextResponse.json({ commissions: [] })
  const { searchParams } = new URL(request.url)
  const commissions = await listCommissions({
    payment_status: searchParams.get("payment_status") || undefined,
    approval_status: searchParams.get("approval_status") || undefined,
  })
  return NextResponse.json({ commissions })
}

export interface CommissionInput {
  earner_label: string
  candidate_id?: string | null
  user_id?: string | null
  vacancy_id?: string | null
  role_template_id?: string | null
  lead_id?: string | null
  business_id?: string | null
  revenue_category: string
  lead_source?: string
  qualifying_amount_kobo: number
  refunded?: boolean
  earned_at?: string
  notes?: string | null
}

/* POST: record an earned commission. The amount is computed server-side from
 * the vacancy/template commission rules — never trusted from the client.
 * Requires careers.compensation.manage. */
export async function POST(request: Request) {
  const { session, denied } = await authorizeAdmin("careers.compensation.manage")
  if (denied) return denied
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Database not configured" }, { status: 503 })

  const input = (await request.json().catch(() => ({}))) as CommissionInput
  const earner = String(input.earner_label || "").trim()
  const category = String(input.revenue_category || "").trim()
  const qualifying = Number(input.qualifying_amount_kobo)
  if (!earner) return NextResponse.json({ error: "Earner is required" }, { status: 400 })
  if (!category) return NextResponse.json({ error: "Revenue category is required" }, { status: 400 })
  if (!Number.isFinite(qualifying) || qualifying < 0) {
    return NextResponse.json({ error: "Invalid qualifying amount" }, { status: 400 })
  }
  const leadSource = (input.lead_source || "COMPANY_GENERATED").toUpperCase()
  if (!LEAD_SOURCES.includes(leadSource as never)) {
    return NextResponse.json({ error: "Invalid lead source" }, { status: 400 })
  }

  // Resolve commission rules: vacancy → template → empty.
  let rules: CommissionRules = {}
  let basis: "PERCENTAGE" | "FIXED" = "PERCENTAGE"
  if (input.vacancy_id) {
    const { data: v } = await supabase
      .from("career_vacancies")
      .select("commission_rules")
      .eq("id", input.vacancy_id)
      .maybeSingle()
    if (v?.commission_rules) rules = v.commission_rules as CommissionRules
  } else if (input.role_template_id) {
    const { data: t } = await supabase
      .from("career_role_templates")
      .select("commission_rules")
      .eq("id", input.role_template_id)
      .maybeSingle()
    if (t?.commission_rules) rules = t.commission_rules as CommissionRules
  }

  const result = computeCommission(rules, {
    category,
    amountKobo: qualifying,
    leadSource: leadSource as LeadSource,
    refunded: input.refunded === true,
  })
  if (!result.eligible) {
    return NextResponse.json({ error: result.reason || "Not commissionable" }, { status: 422 })
  }
  basis = (rules.basis || "PERCENTAGE") as "PERCENTAGE" | "FIXED"

  const now = new Date().toISOString()
  const id = crypto.randomUUID()
  const { error: insErr } = await supabase.from("career_commissions").insert({
    id,
    earner_label: earner,
    candidate_id: input.candidate_id || null,
    user_id: input.user_id || null,
    vacancy_id: input.vacancy_id || null,
    role_template_id: input.role_template_id || null,
    lead_id: input.lead_id || null,
    business_id: input.business_id || null,
    revenue_category: category,
    lead_source: leadSource,
    qualifying_amount_kobo: qualifying,
    basis,
    rate: result.rate,
    amount_kobo: result.amountKobo,
    approval_status: "PENDING",
    payment_status: result.payable ? "PAYABLE" : "EARNED",
    earned_at: input.earned_at || now,
    payable_at: result.payable ? now : null,
    notes: input.notes || null,
  })
  if (insErr) {
    console.error("[careers] commission insert failed:", insErr.message)
    return NextResponse.json({ error: "Failed to record commission" }, { status: 500 })
  }

  await recordAudit(auditContextFromSession(session, request), {
    action: AUDIT_ACTIONS.CAREER_COMMISSION_RECORDED,
    entityType: AUDIT_ENTITIES.CAREER_COMMISSION,
    entityId: id,
    metadata: { earner, category, amountKobo: result.amountKobo, leadSource },
  })
  return NextResponse.json({ success: true, id, amount_kobo: result.amountKobo, payable: result.payable })
}
