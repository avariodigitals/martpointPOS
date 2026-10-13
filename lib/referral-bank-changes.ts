/* ───────────────────────────  Bank detail changes (reverify + dual approval)  ───────────────────────────
 * Verified payout details are write-once for the partner. Moving money to a new
 * account requires: a recorded request, an independent reverification of the new
 * account, then TWO DIFFERENT approvers, enforced by lib/referral-permissions.
 * The profile is only rewritten when the request itself reaches APPROVED.
 */

import { supabase, isSupabaseConfigured } from "./supabase"
import { recordAudit, AUDIT_ACTIONS, AUDIT_ENTITIES, type AuditContext } from "./audit"
import { bankChangeDualApproval } from "./referral-permissions"
import { emitReferralNotification } from "./referral-notifications"

export interface BankChangeActor {
  actorType: "ADMIN" | "PARTNER" | "SYSTEM"
  actorId: string | null
  actorName: string | null
}

export interface BankChangeRow {
  id: string
  partner_id: string
  status: string
  old_bank_name: string
  old_account_last4: string
  new_bank_name: string
  new_account_number: string
  new_account_name: string
  reason: string
  requested_by: string | null
  requested_by_name: string
  reverified_by: string | null
  reverified_at: string | null
  first_approval_by: string | null
  first_approval_at: string | null
  second_approval_by: string | null
  second_approval_at: string | null
  created_at: string
}

function ctxOf(actor: BankChangeActor): AuditContext {
  return {
    actorType: actor.actorType as AuditContext["actorType"],
    actorId: actor.actorId ?? undefined,
    actorName: actor.actorName ?? undefined,
  }
}

const str = (v: unknown) => (v == null ? "" : String(v))

function last4(account: string): string {
  const digits = account.replace(/\D/g, "")
  return digits ? digits.slice(-4) : ""
}

async function load(id: string): Promise<BankChangeRow | null> {
  const { data } = await supabase.from("partner_bank_change_requests").select("*").eq("id", id).maybeSingle()
  return (data as BankChangeRow | null) ?? null
}

async function partnerName(partnerId: string): Promise<string> {
  const { data } = await supabase.from("partners").select("business_name").eq("id", partnerId).maybeSingle()
  return str(data?.business_name) || "the partner"
}

/* ─── Request (partner or Finance on the partner's behalf) ─── */
export async function requestBankChange(input: {
  partnerId: string
  actor: BankChangeActor
  newBankName: string
  newAccountNumber: string
  newAccountName: string
  reason: string
}): Promise<{ ok: boolean; error?: string; id?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Database not configured" }
  const account = input.newAccountNumber.replace(/\s/g, "")
  if (!/^\d{9,17}$/.test(account)) return { ok: false, error: "Enter a valid bank account number" }
  if (!input.newBankName.trim()) return { ok: false, error: "A bank name is required" }
  if (!input.reason.trim()) return { ok: false, error: "Say why the account is changing — it is kept on the record" }

  const { data: profile } = await supabase
    .from("partner_payout_profiles")
    .select("bank_name, account_number, verification_status")
    .eq("partner_id", input.partnerId)
    .maybeSingle()
  const existing = profile as Record<string, unknown> | null
  if (existing && last4(str(existing.account_number)) === last4(account) && str(existing.bank_name) === input.newBankName.trim()) {
    return { ok: false, error: "That is already the account on file" }
  }

  const nowIso = new Date().toISOString()
  const { data, error } = await supabase
    .from("partner_bank_change_requests")
    .insert({
      partner_id: input.partnerId,
      requested_by: input.actor.actorId,
      requested_by_name: input.actor.actorName || "",
      old_bank_name: str(existing?.bank_name),
      old_account_last4: last4(str(existing?.account_number)),
      new_bank_name: input.newBankName.trim(),
      new_account_number: account,
      new_account_name: input.newAccountName.trim(),
      reason: input.reason.trim(),
      status: "PENDING",
      created_at: nowIso,
      updated_at: nowIso,
    })
    .select("id")
    .single()
  if (error || !data) return { ok: false, error: error?.message || "Could not record the request" }

  await recordAudit(ctxOf(input.actor), {
    action: AUDIT_ACTIONS.REFERRAL_BANK_CHANGE_REQUESTED,
    entityType: AUDIT_ENTITIES.PARTNER_BANK_CHANGE_REQUEST,
    entityId: str(data.id),
    metadata: {
      partnerId: input.partnerId,
      from: `${str(existing?.bank_name)} ••••${last4(str(existing?.account_number))}`,
      to: `${input.newBankName} ••••${last4(account)}`,
    },
  })

  await emitReferralNotification({
    event: "BANK_CHANGE_REQUESTED",
    title: "Bank detail change requested",
    body: `${await partnerName(input.partnerId)} asked to move payouts to ${input.newBankName} ending ${last4(account)}. Reverification and two approvals are required.`,
    partnerId: null,
    link: `/admin/partners/bank-changes`,
    sourceType: "bank_change_request",
    sourceId: str(data.id),
    emailTo: null,
  })

  return { ok: true, id: str(data.id) }
}

/* ─── Reverification (before any approval) ─── */
export async function markBankChangeReverified(
  id: string,
  actor: BankChangeActor,
  note: string
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Database not configured" }
  const row = await load(id)
  if (!row) return { ok: false, error: "Request not found" }
  if (row.status !== "PENDING") return { ok: false, error: `A ${row.status.toLowerCase()} request cannot be reverified` }
  if (!note.trim()) return { ok: false, error: "Record how the new account was verified" }

  const nowIso = new Date().toISOString()
  const { error } = await supabase
    .from("partner_bank_change_requests")
    .update({ reverified_by: actor.actorId, reverified_at: nowIso, updated_at: nowIso })
    .eq("id", id)
  if (error) return { ok: false, error: error.message }

  await recordAudit(ctxOf(actor), {
    action: AUDIT_ACTIONS.REFERRAL_BANK_CHANGE_REQUESTED,
    entityType: AUDIT_ENTITIES.PARTNER_BANK_CHANGE_REQUEST,
    entityId: id,
    metadata: { step: "REVERIFIED", note: note.trim(), partnerId: row.partner_id },
  })
  return { ok: true }
}

/* ─── Approval: first then a different second approver ─── */
export async function approveBankChange(
  id: string,
  actor: BankChangeActor
): Promise<{ ok: boolean; error?: string; awaitingSecondApproval?: boolean }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Database not configured" }
  const row = await load(id)
  if (!row) return { ok: false, error: "Request not found" }
  if (row.status !== "PENDING") return { ok: false, error: "This request is already decided" }

  const nowIso = new Date().toISOString()

  if (!row.first_approval_by) {
    if (!row.reverified_at) return { ok: false, error: "Reverify the new account before approving it" }
    if (row.requested_by && row.requested_by === actor.actorId) {
      return { ok: false, error: "The person who requested the change cannot approve it" }
    }
    await supabase
      .from("partner_bank_change_requests")
      .update({ first_approval_by: actor.actorId, first_approval_at: nowIso, updated_at: nowIso })
      .eq("id", id)
    await recordAudit(ctxOf(actor), {
      action: AUDIT_ACTIONS.REFERRAL_BANK_CHANGE_REQUESTED,
      entityType: AUDIT_ENTITIES.PARTNER_BANK_CHANGE_REQUEST,
      entityId: id,
      metadata: { step: "FIRST_APPROVAL", partnerId: row.partner_id },
    })
    return { ok: true, awaitingSecondApproval: true }
  }

  const decision = bankChangeDualApproval({
    requestedBy: row.requested_by,
    firstApprovalBy: row.first_approval_by,
    secondApprovalBy: actor.actorId,
    reverified: Boolean(row.reverified_at),
  })
  if (!decision.approved) return { ok: false, error: decision.reason }

  await supabase
    .from("partner_bank_change_requests")
    .update({
      status: "APPROVED",
      second_approval_by: actor.actorId,
      second_approval_at: nowIso,
      applied_at: nowIso,
      updated_at: nowIso,
    })
    .eq("id", id)

  await supabase
    .from("partner_payout_profiles")
    .update({
      bank_name: row.new_bank_name,
      account_number: row.new_account_number,
      account_name: row.new_account_name,
      verification_status: "VERIFIED",
      verified_at: nowIso,
      verified_by: actor.actorId,
      verification_notes: `Applied through approved bank change ${id}`,
      updated_at: nowIso,
    })
    .eq("partner_id", row.partner_id)

  await recordAudit(ctxOf(actor), {
    action: AUDIT_ACTIONS.REFERRAL_BANK_CHANGE_APPROVED,
    entityType: AUDIT_ENTITIES.PARTNER_BANK_CHANGE_REQUEST,
    entityId: id,
    metadata: {
      partnerId: row.partner_id,
      applied: `${row.new_bank_name} ••••${last4(row.new_account_number)}`,
      firstApprover: row.first_approval_by,
      secondApprover: actor.actorId,
    },
  })

  await emitReferralNotification({
    event: "BANK_CHANGE_DECIDED",
    title: "Payout account updated",
    body: `MartPoint approved your change of payout account to ${row.new_bank_name} ending ${last4(row.new_account_number)}.`,
    partnerId: row.partner_id,
    link: "/partner/commissions",
    sourceType: "bank_change_request",
    sourceId: id,
    emailTo: null,
  })

  return { ok: true }
}

export async function rejectBankChange(
  id: string,
  actor: BankChangeActor,
  reason: string
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Database not configured" }
  const row = await load(id)
  if (!row) return { ok: false, error: "Request not found" }
  if (row.status !== "PENDING") return { ok: false, error: "This request is already decided" }
  if (!reason.trim()) return { ok: false, error: "A rejection needs a recorded reason" }

  const nowIso = new Date().toISOString()
  await supabase
    .from("partner_bank_change_requests")
    .update({ status: "REJECTED", rejection_reason: reason.trim(), updated_at: nowIso })
    .eq("id", id)

  await recordAudit(ctxOf(actor), {
    action: AUDIT_ACTIONS.REFERRAL_BANK_CHANGE_APPROVED,
    entityType: AUDIT_ENTITIES.PARTNER_BANK_CHANGE_REQUEST,
    entityId: id,
    metadata: { partnerId: row.partner_id, decision: "REJECTED", reason: reason.trim() },
  })

  await emitReferralNotification({
    event: "BANK_CHANGE_DECIDED",
    title: "Payout account change declined",
    body: reason.trim(),
    partnerId: row.partner_id,
    link: "/partner/commissions",
    sourceType: "bank_change_request",
    sourceId: id,
    emailTo: null,
  })
  return { ok: true }
}

/* ─── Reads ─── */

export async function listBankChanges(filters: { status?: string | null; partnerId?: string | null } = {}): Promise<BankChangeRow[]> {
  if (!isSupabaseConfigured()) return []
  let q = supabase.from("partner_bank_change_requests").select("*").order("created_at", { ascending: false }).limit(200)
  if (filters.status) q = q.eq("status", filters.status)
  if (filters.partnerId) q = q.eq("partner_id", filters.partnerId)
  const { data } = await q
  return (data || []) as BankChangeRow[]
}

export async function getBankChangePartnerName(row: BankChangeRow): Promise<string> {
  return partnerName(row.partner_id)
}
