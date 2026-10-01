/* ───────────────────────────  Creator referral attribution  ───────────────────────────
 * Creator tracking links look like:  https://martpoint.com.ng/?ref=MP-00001&utm_*
 *
 * A small client component (components/creator-ref-capture.tsx) notices the
 * ref param, calls POST /api/creator/track, which records a CLICK event and
 * sets an httpOnly cookie. Later, /api/leads and /api/demo-booking read the
 * cookie server-side and attribute the lead/demo to the creator.
 *
 * Creator codes use the pattern MP-<digits> which is intentionally disjoint
 * from partner codes (MP-<REGION>-<digits>) — no existing partner behaviour
 * is affected.
 */

import { cookies } from "next/headers"
import { supabase, isSupabaseConfigured } from "./supabase"

export const CREATOR_REF_COOKIE = "mp_creator_ref"
export const CREATOR_REF_PATTERN = /^MP-\d{1,6}$/i

export interface CreatorRefContext {
  code: string
  utmSource?: string | null
  utmMedium?: string | null
  utmCampaign?: string | null
  utmContent?: string | null
}

/** Encode the ref context into a compact cookie value. */
export function encodeCreatorRef(ctx: CreatorRefContext): string {
  return Buffer.from(JSON.stringify({
    c: ctx.code,
    s: ctx.utmSource || undefined,
    m: ctx.utmMedium || undefined,
    p: ctx.utmCampaign || undefined,
    t: ctx.utmContent || undefined,
  })).toString("base64url")
}

/** Parse a ref cookie value; null on anything malformed. */
export function decodeCreatorRef(raw: string | undefined | null): CreatorRefContext | null {
  if (!raw) return null
  try {
    const v = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as Record<string, unknown>
    const code = String(v.c || "")
    if (!CREATOR_REF_PATTERN.test(code)) return null
    return {
      code: code.toUpperCase(),
      utmSource: v.s ? String(v.s) : null,
      utmMedium: v.m ? String(v.m) : null,
      utmCampaign: v.p ? String(v.p) : null,
      utmContent: v.t ? String(v.t) : null,
    }
  } catch {
    return null
  }
}

/** Read the ref context in a route handler (await cookies() — Next 16). */
export async function readCreatorRef(): Promise<CreatorRefContext | null> {
  const store = await cookies()
  return decodeCreatorRef(store.get(CREATOR_REF_COOKIE)?.value)
}

/** Resolve a referral code to an ACTIVE creator. */
export async function resolveCreatorRef(code: string): Promise<{ id: string; referralCode: string } | null> {
  if (!isSupabaseConfigured() || !CREATOR_REF_PATTERN.test(code)) return null
  const { data } = await supabase
    .from("creators")
    .select("id, referral_code")
    .ilike("referral_code", code.trim())
    .eq("status", "ACTIVE")
    .maybeSingle()
  return data ? { id: data.id as string, referralCode: data.referral_code as string } : null
}

/** Append a funnel event (CLICK/LEAD/DEMO/SIGNUP/CUSTOMER) for a creator. */
export async function recordCreatorReferral(input: {
  creatorId: string
  referralCode: string
  eventType: "CLICK" | "LEAD" | "DEMO" | "SIGNUP" | "CUSTOMER"
  leadId?: string | null
  businessId?: string | null
  challengeId?: string | null
  submissionId?: string | null
  utm?: { source?: string | null; medium?: string | null; campaign?: string | null; content?: string | null } | null
  pagePath?: string | null
  referrer?: string | null
  ip?: string | null
  userAgent?: string | null
}): Promise<void> {
  if (!isSupabaseConfigured()) return
  try {
    await supabase.from("creator_referrals").insert({
      creator_id: input.creatorId,
      referral_code: input.referralCode,
      event_type: input.eventType,
      lead_id: input.leadId ?? null,
      business_id: input.businessId ?? null,
      challenge_id: input.challengeId ?? null,
      submission_id: input.submissionId ?? null,
      utm_source: input.utm?.source ?? null,
      utm_medium: input.utm?.medium ?? null,
      utm_campaign: input.utm?.campaign ?? null,
      utm_content: input.utm?.content ?? null,
      page_path: input.pagePath ?? null,
      referrer: input.referrer ?? null,
      ip: input.ip ?? null,
      user_agent: input.userAgent ?? null,
    })
  } catch (err) {
    console.error("[creator-ref] referral insert failed:", err)
  }
}
