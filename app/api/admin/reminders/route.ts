import { NextResponse } from "next/server"
import { authorizeAdmin } from "@/lib/admin-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { cancelAutomationRuns } from "@/lib/automations"
import { recordAudit, AUDIT_ACTIONS, AUDIT_ENTITIES, auditContextFromSession } from "@/lib/audit"
import { z } from "zod"

/* ───────────────────  Admin: pause / resume automated reminders  ───────────────────
 * A lead or quotation can be opted out of the 48h follow-up sequences (and any
 * future automation) either by the recipient (one-click unsubscribe) or by an
 * admin on their behalf — e.g. "client says stop notifying them".
 *
 * `scope`:
 *   • "reminders"        — pause only the automated follow-ups (default).
 *   • "do_not_contact"   — also add the email to the global suppression list,
 *                          so marketing campaigns skip them too.
 *
 * Setting `paused = true`:
 *   • flips the source record's `reminders_paused` flag (the engine checks it
 *     before every send), and
 *   • cancels any pending automation runs so nothing sits queued.
 *
 * Resuming does NOT re-create old runs; the next relevant send re-enqueues.
 * Resuming a "do_not_contact" also lifts the global suppression (only if the
 * admin explicitly asks to resume).
 */

const bodySchema = z.object({
  type: z.enum(["lead", "quotation"]),
  id: z.string().uuid(),
  paused: z.boolean(),
  scope: z.enum(["reminders", "do_not_contact"]).default("reminders"),
})

export async function POST(request: Request) {
  const auth = await authorizeAdmin("leads")
  if (auth.denied) return auth.denied
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Not configured" }, { status: 500 })

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 })

  const { type, id, paused, scope } = parsed.data
  const now = new Date().toISOString()
  let email = ""

  if (type === "lead") {
    const { data, error } = await supabase
      .from("leads")
      .update({ reminders_paused: paused, updated_at: now })
      .eq("id", id)
      .select("email")
      .maybeSingle()
    if (error) return NextResponse.json({ error: "Failed to update reminders" }, { status: 500 })
    email = (data?.email as string) || ""
  } else {
    const { data, error } = await supabase
      .from("lead_quotations")
      .update({ reminders_paused: paused, updated_at: now })
      .eq("id", id)
      .select("lead:leads (email)")
      .maybeSingle()
    if (error) return NextResponse.json({ error: "Failed to update reminders" }, { status: 500 })
    const leadRaw = data?.lead as Record<string, unknown> | Record<string, unknown>[] | null | undefined
    const lead = Array.isArray(leadRaw) ? leadRaw[0] : leadRaw
    email = (lead?.email as string) || ""
  }

  // Do-not-contact (or resume) → sync the global suppression list so marketing
  // campaigns honour it too.
  if (scope === "do_not_contact" && email) {
    const normalized = email.trim().toLowerCase()
    if (paused) {
      await supabase
        .from("marketing_unsubscribes")
        .upsert({ email: normalized, source: "admin_do_not_contact" }, { onConflict: "email" })
    } else {
      await supabase.from("marketing_unsubscribes").delete().eq("email", normalized)
    }
  }

  // Cancel pending runs so a paused record is not sitting queued; on resume we
  // simply let the next event re-enqueue.
  let cancelled = 0
  if (paused) {
    cancelled = await cancelAutomationRuns(type, id, "paused_by_admin").catch(() => 0)
  }

  await recordAudit(auditContextFromSession(auth.session, request), {
    action: AUDIT_ACTIONS.LEAD_UPDATED,
    entityType: AUDIT_ENTITIES.LEAD,
    entityId: id,
    metadata: { remindersPaused: paused, type, scope, cancelledRuns: cancelled },
  })

  return NextResponse.json({ success: true, remindersPaused: paused, scope, cancelledRuns: cancelled })
}
