/* ───────────────────────────  Conversion pipeline ownership  ───────────────────────────
 * Which workforce role owns each conversion stage, plus the handover ledger
 * recording every transfer of responsibility between owners.
 *
 * Server-side only — uses the service-role client.
 */

import { supabase, isSupabaseConfigured } from "./supabase"

export const PIPELINE_STAGE_KEYS = [
  "NEW_LEAD",
  "QUALIFICATION",
  "DEMO",
  "PROPOSAL",
  "COMMERCIAL_APPROVAL",
  "ENTERPRISE_APPROVAL",
  "PAYMENT_CONFIRMATION",
  "IMPLEMENTATION",
  "ACTIVATION",
  "POST_GO_LIVE_SUPPORT",
  "ADOPTION_RENEWAL",
  "MARKETING_ATTRIBUTION",
] as const
export type PipelineStageKey = (typeof PIPELINE_STAGE_KEYS)[number]

export const HANDOVER_ACCEPTANCE_STATUSES = ["PENDING", "ACCEPTED", "DECLINED"] as const

export interface PipelineStageOwner {
  id: string
  stage_key: string
  label: string
  responsible_role: string
  sort_order: number
  active: boolean
}

export interface PipelineHandover {
  id: string
  subject_type: "LEAD" | "CUSTOMER"
  lead_id: string | null
  business_id: string | null
  subject_label: string | null
  pipeline_stage: string
  previous_owner: string | null
  new_owner: string
  previous_owner_id: string | null
  new_owner_id: string | null
  handed_at: string
  required_action: string | null
  deadline: string | null
  notes: string | null
  attached_documents: { name: string; url?: string }[]
  acceptance_status: (typeof HANDOVER_ACCEPTANCE_STATUSES)[number]
  accepted_at: string | null
  created_by: string | null
  created_at: string
}

export async function listStageOwners(): Promise<PipelineStageOwner[]> {
  if (!isSupabaseConfigured()) return []
  const { data } = await supabase
    .from("career_pipeline_stage_owners")
    .select("*")
    .order("sort_order")
  return (data || []) as PipelineStageOwner[]
}

export async function listHandovers(filters: { stage?: string; leadId?: string } = {}): Promise<PipelineHandover[]> {
  if (!isSupabaseConfigured()) return []
  let query = supabase
    .from("career_pipeline_handovers")
    .select("*")
    .order("handed_at", { ascending: false })
    .limit(500)
  if (filters.stage) query = query.eq("pipeline_stage", filters.stage)
  if (filters.leadId) query = query.eq("lead_id", filters.leadId)
  const { data } = await query
  return (data || []) as PipelineHandover[]
}

/** Latest handover per subject — used to show current owner. */
export function currentOwners(handovers: PipelineHandover[]): Map<string, PipelineHandover> {
  const map = new Map<string, PipelineHandover>()
  for (const h of handovers) {
    const key = h.lead_id || h.business_id || h.subject_label || "unknown"
    const existing = map.get(key)
    if (!existing || new Date(h.handed_at) > new Date(existing.handed_at)) map.set(key, h)
  }
  return map
}
