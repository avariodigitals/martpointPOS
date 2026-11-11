import { NextResponse } from "next/server"
import { authorizeAdmin } from "@/lib/admin-auth"
import { encryptPaystackSecret, getPaystackSettingsSummary, loadPaystackConfiguration, type PaystackMode } from "@/lib/paystack-settings"
import { isSupabaseConfigured, supabase } from "@/lib/supabase"

export const dynamic = "force-dynamic"

async function adminOnly() {
  const auth = await authorizeAdmin("settings")
  if (auth.denied) return { denied: auth.denied, session: null }
  if (auth.session.role !== "Admin") return { denied: NextResponse.json({ error: "Only an Admin can manage Paystack credentials." }, { status: 403 }), session: null }
  return { denied: null, session: auth.session }
}

export async function GET() {
  const { denied } = await adminOnly()
  if (denied) return denied
  try {
    const settings = await getPaystackSettingsSummary()
    return NextResponse.json({ success: true, settings }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Paystack settings are unavailable." }, { status: 503 })
  }
}

export async function PUT(request: Request) {
  const { denied, session } = await adminOnly()
  if (denied || !session) return denied
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 })
  try {
    const body = await request.json() as Record<string, unknown>
    const activeMode = body.activeMode
    if (activeMode !== "test" && activeMode !== "live") return NextResponse.json({ error: "Choose test or live mode." }, { status: 400 })
    const testSecret = typeof body.testSecret === "string" ? body.testSecret.trim() : ""
    const liveSecret = typeof body.liveSecret === "string" ? body.liveSecret.trim() : ""
    if (testSecret && (!testSecret.startsWith("sk_test_") || testSecret.length > 512)) return NextResponse.json({ error: "The test secret must be a valid Paystack sk_test_ key." }, { status: 400 })
    if (liveSecret && (!liveSecret.startsWith("sk_live_") || liveSecret.length > 512)) return NextResponse.json({ error: "The live secret must be a valid Paystack sk_live_ key." }, { status: 400 })

    const { data: current, error: readError } = await supabase.from("paystack_gateway_settings").select("live_secret_encrypted,test_secret_encrypted,created_at").eq("id", 1).maybeSingle()
    if (readError) return NextResponse.json({ error: "Apply migration 187 before saving Paystack settings." }, { status: 503 })
    const existingConfig = await loadPaystackConfiguration()
    const effectiveLiveSecret = body.clearLiveSecret === true ? (liveSecret || process.env.PAYSTACK_SECRET_KEY || "") : liveSecret || existingConfig.liveSecret
    const effectiveTestSecret = body.clearTestSecret === true ? (testSecret || process.env.PAYSTACK_TEST_SECRET_KEY || "") : testSecret || existingConfig.testSecret
    if (activeMode === "live" && !effectiveLiveSecret) return NextResponse.json({ error: "Add a live secret key or select Test mode before saving." }, { status: 400 })
    if (activeMode === "test" && !effectiveTestSecret) return NextResponse.json({ error: "Add a test secret key or select Live mode before saving." }, { status: 400 })
    const next = {
      id: 1,
      active_mode: activeMode as PaystackMode,
      live_secret_encrypted: body.clearLiveSecret === true ? null : liveSecret ? encryptPaystackSecret(liveSecret) : current?.live_secret_encrypted || null,
      test_secret_encrypted: body.clearTestSecret === true ? null : testSecret ? encryptPaystackSecret(testSecret) : current?.test_secret_encrypted || null,
      updated_by: session.userId,
      updated_at: new Date().toISOString(),
      ...(current?.created_at ? { created_at: current.created_at } : {}),
    }
    const { error: saveError } = await supabase.from("paystack_gateway_settings").upsert(next, { onConflict: "id" })
    if (saveError) return NextResponse.json({ error: "Could not save Paystack settings." }, { status: 500 })
    const settings = await getPaystackSettingsSummary()
    return NextResponse.json({ success: true, settings }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not save Paystack settings." }, { status: 400 })
  }
}
