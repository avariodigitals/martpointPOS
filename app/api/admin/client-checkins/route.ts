import { NextResponse } from "next/server"
import { revalidateTag } from "next/cache"
import { isAdminAuthenticated } from "@/lib/admin-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { getAutomationByKey, getClientCheckinConfig, runAutomationSweep } from "@/lib/automations"
import {
  CLIENT_CHECKIN_KEY,
  getCheckinOverview,
  startCheckins,
  runCheckinNow,
  backfillOverdueCheckins,
} from "@/lib/client-checkins"

/* ───────────────────  Client founder check-ins (admin)  ───────────────────
 * Backs Settings → Client Check-ins: the live view of the welcome +
 * 30/60/90/120-day sequence, its config, and the manual trigger buttons
 * (start a client, send the next check-in now, backfill overdue clients).
 */

export const dynamic = "force-dynamic"

async function loadClientCheckinsSection(): Promise<Record<string, unknown>> {
  if (!isSupabaseConfigured()) return {}
  const { data } = await supabase.from("settings").select("data").eq("id", 1).single()
  const stored = (data?.data as Record<string, unknown> | undefined) || {}
  return (stored.clientCheckins as Record<string, unknown>) || {}
}

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 })
  }

  try {
    const [automation, config, clients] = await Promise.all([
      getAutomationByKey(CLIENT_CHECKIN_KEY),
      getClientCheckinConfig(),
      getCheckinOverview(),
    ])
    const stored = await loadClientCheckinsSection()
    return NextResponse.json({
      config: {
        welcomeEnabled: config.welcomeEnabled,
        founderName: config.founderName,
        founderEmail: config.founderEmail,
        milestoneTemplates: config.milestoneTemplates,
        savedAt: (stored.savedAt as string) || null,
      },
      automation: automation
        ? {
            id: automation.id,
            enabled: automation.enabled,
            delayDays: Math.round(automation.delayMinutes / 1440),
            intervalDays: Math.round(automation.intervalMinutes / 1440),
            maxSteps: automation.maxSteps,
          }
        : null,
      clients,
    })
  } catch (err) {
    console.error("[client-checkins api]", err)
    return NextResponse.json({ error: "Failed to load check-in state" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }
  const action = String(body.action || "")

  try {
    switch (action) {
      case "config": {
        const founderName = String(body.founderName || "").replace(/[<>\r\n]/g, "").trim().slice(0, 60)
        const founderEmail = String(body.founderEmail || "").trim().slice(0, 160)
        if (founderEmail && !/^[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+$/.test(founderEmail)) {
          return NextResponse.json({ error: "Founder email is not valid" }, { status: 400 })
        }
        const stored = await loadClientCheckinsSection()
        const section = {
          ...stored,
          welcomeEnabled: body.welcomeEnabled !== false,
          founderName: founderName || "Ralph",
          founderEmail: founderEmail || "ralph@martpoint.com.ng",
          savedAt: new Date().toISOString(),
        }
        const { data: row } = await supabase.from("settings").select("data").eq("id", 1).single()
        const all = (row?.data as Record<string, unknown>) || {}
        const { error } = await supabase
          .from("settings")
          .upsert({ id: 1, data: { ...all, clientCheckins: section }, updated_at: new Date().toISOString() })
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        revalidateTag("settings", { expire: 0 })
        return NextResponse.json({ ok: true, config: section })
      }

      case "toggle": {
        const automation = await getAutomationByKey(CLIENT_CHECKIN_KEY)
        if (!automation) return NextResponse.json({ error: "Run migration 089 first" }, { status: 500 })
        const enabled = body.enabled === true
        const { error } = await supabase
          .from("automations")
          .update({ enabled, updated_at: new Date().toISOString() })
          .eq("id", automation.id)
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ ok: true, enabled })
      }

      case "start": {
        const businessId = String(body.businessId || "")
        if (!businessId) return NextResponse.json({ error: "businessId is required" }, { status: 400 })
        const res = await startCheckins(businessId, {
          sendWelcome: body.sendWelcome === true,
          anchorAt: body.anchorAt ? String(body.anchorAt) : undefined,
        })
        return NextResponse.json(res, res.ok ? { status: 200 } : { status: 400 })
      }

      case "run-now": {
        const businessId = String(body.businessId || "")
        if (!businessId) return NextResponse.json({ error: "businessId is required" }, { status: 400 })
        const res = await runCheckinNow(businessId)
        return NextResponse.json(res, res.ok ? { status: 200 } : { status: 400 })
      }

      case "backfill": {
        const res = await backfillOverdueCheckins({ sendWelcome: body.sendWelcome === true })
        return NextResponse.json({ ok: true, ...res })
      }

      case "sweep": {
        const result = await runAutomationSweep()
        return NextResponse.json({ ok: true, ...result })
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
    }
  } catch (err) {
    console.error("[client-checkins api]", err)
    return NextResponse.json({ error: err instanceof Error ? err.message : "Request failed" }, { status: 500 })
  }
}
