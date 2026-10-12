/* ───────────────────  Explee hot-lead sync (server-only)  ───────────────────
 * Polls Explee's AutoGTM hot-leads feed, files each new hot lead through the
 * shared lead intake pipeline (source "explee", external_id "explee:<person_id>")
 * and mirrors the Explee conversation into lead_emails so the Email tab shows
 * what Explee sent plus the lead's replies. Triggered by /api/cron/explee-sync.
 */

import { supabase, isSupabaseConfigured } from "./supabase"
import { processLead, type LeadInput } from "./process-lead"

const EXPLEE_API_BASE = "https://api.explee.com"
const PAGE_SIZE = 100
const MAX_PAGES = 25
const MAX_NEW_LEADS_PER_RUN = 30
const MAX_THREAD_SYNCS_PER_RUN = 20
/** Threads are re-polled after this long to pick up later replies. */
const THREAD_REFRESH_MS = 6 * 60 * 60 * 1000
/** Don't bother re-syncing conversations older than this. */
const THREAD_LOOKBACK_DAYS = 30

export interface ExpleeHotLead {
  person_id: string
  campaign_id: number | null
  name: string | null
  email: string | null
  job_title: string | null
  company_name: string | null
  company_domain: string | null
  linkedin_url: string | null
  country: string | null
  phone: string | null
  why_hot: string | null
  became_hot_at: string | null
}

export interface ExpleeThreadMessage {
  /** "sent" (our outbound) or "reply" (their inbound). */
  type: string
  from_email: string | null
  to_email: string | null
  subject: string | null
  body_text: string | null
  message_id: string | null
  /** Delivery status, outbound messages only. */
  status: string | null
  ts: string | null
}

interface ExpleeHotLeadsPage {
  leads: ExpleeHotLead[]
  has_more: boolean
}

interface ExpleeThread {
  messages: ExpleeThreadMessage[]
}

async function expleeGet<T>(path: string, apiKey: string): Promise<T> {
  const res = await fetch(`${EXPLEE_API_BASE}${path}`, {
    headers: { "X-API-Key": apiKey },
    cache: "no-store",
  })
  if (!res.ok) throw new Error(`Explee ${path} returned ${res.status}`)
  return (await res.json()) as T
}

export async function fetchHotLeads(apiKey: string, since: string | null): Promise<ExpleeHotLead[]> {
  const out: ExpleeHotLead[] = []
  for (let page = 0; page < MAX_PAGES; page++) {
    const qs = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(page * PAGE_SIZE) })
    if (since) qs.set("since", since)
    const data = await expleeGet<ExpleeHotLeadsPage>(`/public/api/v1/autogtm/hot-leads?${qs}`, apiKey)
    out.push(...(data.leads || []))
    if (!data.has_more) break
  }
  return out
}

/** Maps a hot lead onto the shared lead intake fields. Pure — covered by tests. */
export function buildExpleeLeadInput(lead: ExpleeHotLead): LeadInput | null {
  const email = (lead.email || "").trim()
  if (!email) return null

  const details = [
    lead.job_title && `Role: ${lead.job_title}`,
    lead.company_domain && `Website: ${lead.company_domain}`,
    lead.linkedin_url && `LinkedIn: ${lead.linkedin_url}`,
    lead.country && `Country: ${lead.country}`,
  ].filter(Boolean)

  const message = [
    `Explee hot lead${lead.campaign_id ? ` (campaign ${lead.campaign_id})` : ""}.`,
    details.length ? details.join("\n") : "",
    lead.why_hot ? `\nTheir reply:\n${lead.why_hot}` : "",
  ]
    .filter(Boolean)
    .join("\n")

  return {
    fullName: (lead.name || "").trim() || email,
    businessName: (lead.company_name || "").trim() || "Not provided",
    email,
    phone: (lead.phone || "").trim(),
    businessType: "other",
    productInterest: "not-sure",
    branches: "1",
    staffSize: "1-5",
    message,
    source: "explee",
    externalId: `explee:${lead.person_id}`,
  }
}

/** Maps one Explee thread message onto a lead_emails row. Pure — covered by tests. */
export function mapExpleeMessage(msg: ExpleeThreadMessage, personId: string, index: number) {
  const outbound = msg.type === "sent"
  const failed = ["failed", "bounced"].includes((msg.status || "").toLowerCase())
  return {
    direction: outbound ? ("outbound" as const) : ("inbound" as const),
    from_email: msg.from_email || null,
    to_email: msg.to_email || null,
    subject: msg.subject || null,
    body_text: msg.body_text || null,
    body_html: null,
    status: outbound ? (failed ? ("failed" as const) : ("sent" as const)) : ("received" as const),
    provider: "explee",
    provider_message_id: msg.message_id || `explee:${personId}:${msg.ts || index}`,
    metadata: { explee_person_id: personId },
    ...(msg.ts ? { created_at: msg.ts } : {}),
  }
}

/** Files the Explee conversation into lead_emails (deduped), returns rows inserted. */
async function syncExpleeThread(
  leadId: string,
  personId: string,
  campaignId: number | null,
): Promise<number> {
  const apiKey = process.env.EXPLEE_API_KEY
  if (!apiKey || campaignId == null) return 0

  const thread = await expleeGet<ExpleeThread>(
    `/public/api/v1/autogtm/campaigns/${campaignId}/inbox/${encodeURIComponent(personId)}`,
    apiKey,
  )
  const mapped = (thread.messages || []).map((m, i) => mapExpleeMessage(m, personId, i))

  let filed = 0
  if (mapped.length) {
    const { data: existing } = await supabase
      .from("lead_emails")
      .select("provider_message_id")
      .eq("lead_id", leadId)
      .in("provider_message_id", mapped.map((m) => m.provider_message_id))
    const have = new Set((existing || []).map((r) => r.provider_message_id as string))
    const fresh = mapped.filter((m) => !have.has(m.provider_message_id))
    if (fresh.length) {
      const { error } = await supabase.from("lead_emails").insert(fresh.map((m) => ({ ...m, lead_id: leadId })))
      if (error) throw new Error(`lead_emails insert failed: ${error.message}`)
      filed = fresh.length
    }
  }

  await supabase.from("explee_leads").update({ thread_synced_at: new Date().toISOString() }).eq("lead_id", leadId)
  return filed
}

export interface ExpleeSyncResult {
  imported: number
  threadsSynced: number
  messagesFiled: number
  skipped: number
  notes: string[]
}

export async function syncExpleeHotLeads(): Promise<ExpleeSyncResult> {
  const notes: string[] = []
  const result: ExpleeSyncResult = { imported: 0, threadsSynced: 0, messagesFiled: 0, skipped: 0, notes }

  const apiKey = process.env.EXPLEE_API_KEY
  if (!apiKey) {
    notes.push("EXPLEE_API_KEY not configured")
    return result
  }
  if (!isSupabaseConfigured()) {
    notes.push("supabase not configured")
    return result
  }

  // Cursor: the newest became_hot_at already imported. The feed returns hot
  // leads at/after `since`, so overlap is re-fetched and deduped by external_id.
  const { data: cursorRow } = await supabase
    .from("explee_leads")
    .select("became_hot_at")
    .not("became_hot_at", "is", null)
    .order("became_hot_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  const since = (cursorRow?.became_hot_at as string | null) ?? null

  const hot = await fetchHotLeads(apiKey, since)
  // Oldest first: if a run hits the cap, the cursor only advances past what was
  // processed, so the newer remainder is picked up next run — nothing is skipped.
  hot.sort((a, b) => (a.became_hot_at || "").localeCompare(b.became_hot_at || ""))

  for (const lead of hot.slice(0, MAX_NEW_LEADS_PER_RUN)) {
    const input = buildExpleeLeadInput(lead)
    if (!input || !input.externalId) {
      result.skipped++
      continue
    }
    const externalId = input.externalId

    const { data: existing } = await supabase.from("leads").select("id").eq("external_id", externalId).maybeSingle()
    let leadId = existing?.id as string | undefined
    if (!leadId) {
      const outcome = await processLead(input)
      const { data: row } = await supabase.from("leads").select("id").eq("external_id", externalId).maybeSingle()
      leadId = row?.id as string | undefined
      if (!leadId) {
        notes.push(`import failed for ${externalId}${outcome.success ? "" : `: ${outcome.error}`}`)
        result.skipped++
        continue
      }
      result.imported++
    }

    await supabase.from("explee_leads").upsert({
      lead_id: leadId,
      person_id: lead.person_id,
      campaign_id: lead.campaign_id ?? null,
      became_hot_at: lead.became_hot_at ?? null,
    })

    if (result.threadsSynced < MAX_THREAD_SYNCS_PER_RUN) {
      try {
        result.messagesFiled += await syncExpleeThread(leadId, lead.person_id, lead.campaign_id)
        result.threadsSynced++
      } catch (err) {
        notes.push(`thread sync failed for ${externalId}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }
  }

  // Refresh older conversations so replies that arrive after import are filed too.
  const staleBefore = new Date(Date.now() - THREAD_REFRESH_MS).toISOString()
  const lookback = new Date(Date.now() - THREAD_LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString()
  const { data: stale } = await supabase
    .from("explee_leads")
    .select("lead_id, person_id, campaign_id, thread_synced_at")
    .or(`thread_synced_at.is.null,thread_synced_at.lt.${staleBefore}`)
    .gte("became_hot_at", lookback)
    .order("became_hot_at", { ascending: false })
    .limit(MAX_THREAD_SYNCS_PER_RUN)

  for (const row of stale || []) {
    if (result.threadsSynced >= MAX_THREAD_SYNCS_PER_RUN) break
    try {
      result.messagesFiled += await syncExpleeThread(
        row.lead_id as string,
        row.person_id as string,
        row.campaign_id as number | null,
      )
      result.threadsSynced++
    } catch (err) {
      notes.push(`thread refresh failed for explee:${row.person_id}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return result
}
