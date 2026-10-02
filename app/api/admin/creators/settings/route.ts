import { NextResponse } from "next/server"
import { revalidateTag } from "next/cache"
import { z } from "zod"
import { authorizeAdmin } from "@/lib/admin-auth"
import { readSettings } from "@/lib/settings"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { recordAudit, AUDIT_ACTIONS, auditContextFromSession } from "@/lib/audit"

export const dynamic = "force-dynamic"

/* Creator-module settings live under the `creator` key of the shared settings
 * document (same pattern as `careers`, `scheduling`, etc.). */

const DEFAULTS = {
  applicationsOpen: true,
  autoAiReview: true,
  requireOnboardingBeforeSubmissions: true,
  minimumAge: 18,
  supportWhatsApp: "",
  supportEmail: "",
}

const schema = z.object({
  applicationsOpen: z.boolean().optional(),
  autoAiReview: z.boolean().optional(),
  requireOnboardingBeforeSubmissions: z.boolean().optional(),
  minimumAge: z.number().int().min(13).max(25).optional(),
  supportWhatsApp: z.string().trim().max(30).optional(),
  supportEmail: z.string().trim().email().max(200).or(z.literal("")).optional(),
})

export async function GET() {
  const { denied } = await authorizeAdmin("creator.settings.manage")
  if (denied) return denied
  const settings = await readSettings()
  const creator = (settings?.creator as Record<string, unknown> | undefined) || {}
  return NextResponse.json({ ...DEFAULTS, ...creator })
}

export async function PUT(request: Request) {
  const { session, denied } = await authorizeAdmin("creator.settings.manage")
  if (denied) return denied

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 })
  }

  try {
    const body = schema.parse(await request.json())
    const current = (await readSettings()) || {}
    const existing = (current.creator as Record<string, unknown> | undefined) || {}
    const updated = { ...current, creator: { ...existing, ...body } }

    const { error } = await supabase
      .from("settings")
      .upsert({ id: 1, data: updated, updated_at: new Date().toISOString() })
    if (error) {
      return NextResponse.json({ error: "Failed to save settings" }, { status: 500 })
    }
    revalidateTag("settings", { expire: 0 })

    await recordAudit(auditContextFromSession(session, request), {
      action: AUDIT_ACTIONS.CREATOR_SETTINGS_UPDATED,
      entityType: "creator_settings",
      metadata: body,
    })
    return NextResponse.json({ success: true })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 })
    }
    return NextResponse.json({ error: "Failed to save settings" }, { status: 500 })
  }
}
