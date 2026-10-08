import { NextResponse } from "next/server"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"

/* ───────────────────────────  Reminder opt-out  ───────────────────────────
 * Called by the public /unsubscribe page when a lead or client clicks the
 * "stop reminders" link in an automated follow-up (questionnaire, quote, or
 * estimate). It does two things:
 *
 *   1. Pauses reminders on the source record (leads / lead_quotations).
 *   2. Adds the email to the global suppression list so no further reminder —
 *      or marketing email — reaches it.
 *
 * The link is `type=<lead|quotation|estimate>` + `id=<subjectId>`; we resolve
 * the recipient email from the record itself (never trust an email in the URL).
 *
 * Transactional messages (invoices, receipts, support replies) are NOT affected.
 */

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const type = String(body?.type || "").trim()
    const id = String(body?.id || "").trim()

    if (!type || !id) {
      return NextResponse.json({ error: "Missing opt-out reference" }, { status: 400 })
    }
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: "Service unavailable" }, { status: 500 })
    }

    const now = new Date().toISOString()
    let email = ""
    let paused = false

    if (type === "lead" || type === "estimate") {
      // 'estimate' runs are keyed by the lead id.
      const { data } = await supabase
        .from("leads")
        .select("id, email")
        .eq("id", id)
        .maybeSingle()
      if (!data) return NextResponse.json({ error: "Invalid opt-out link" }, { status: 404 })
      email = (data.email as string) || ""
      const { error } = await supabase
        .from("leads")
        .update({ reminders_paused: true, last_reminder_at: now })
        .eq("id", id)
      if (!error) paused = true
    } else if (type === "quotation") {
      const { data } = await supabase
        .from("lead_quotations")
        .select("id, lead:leads (email)")
        .eq("id", id)
        .maybeSingle()
      if (!data) return NextResponse.json({ error: "Invalid opt-out link" }, { status: 404 })
      const leadRaw = data.lead as Record<string, unknown> | Record<string, unknown>[] | null
      const lead = Array.isArray(leadRaw) ? leadRaw[0] : leadRaw
      email = (lead?.email as string) || ""
      const { error } = await supabase
        .from("lead_quotations")
        .update({ reminders_paused: true, updated_at: now })
        .eq("id", id)
      if (!error) paused = true
    } else {
      return NextResponse.json({ error: "Unknown opt-out type" }, { status: 400 })
    }

    // Also add to the global suppression list so future reminder sends skip it.
    if (email) {
      await supabase
        .from("marketing_unsubscribes")
        .upsert({ email: email.trim().toLowerCase(), source: `reminder_optout:${type}` }, { onConflict: "email" })
    }

    if (!paused) {
      return NextResponse.json({ error: "Failed to update reminder preference" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[reminder opt-out]", err)
    return NextResponse.json({ error: "Failed to opt out" }, { status: 500 })
  }
}
