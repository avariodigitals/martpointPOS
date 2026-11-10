import { NextResponse } from "next/server"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { verifyCentralRequest } from "@/lib/central-billing-auth"

export async function POST(request: Request) {
  const raw = await request.text()
  if (!verifyCentralRequest(request.headers.get("x-central-timestamp") || "", raw, request.headers.get("x-central-signature") || "", new URL(request.url).pathname)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Central billing is unavailable" }, { status: 503 })
  try {
    const body = JSON.parse(raw) as { install_url: string; store_id: number; subaccount_code: string; enabled: boolean }
    if (!/^https:\/\//.test(body.install_url || "") || !Number.isSafeInteger(body.store_id) || body.store_id < 1 || !/^ACCT_[A-Za-z0-9]+$/.test(body.subaccount_code || "") || typeof body.enabled !== "boolean") return NextResponse.json({ error: "Invalid payout route" }, { status: 400 })
    const installUrl = body.install_url.replace(/\/$/, "")
    const { data, error } = await supabase.from("central_installation_mappings").update({ paystack_subaccount_code: body.enabled ? body.subaccount_code : null, paystack_subaccount_enabled: body.enabled, updated_at: new Date().toISOString() }).eq("install_url", installUrl).eq("store_id", body.store_id).eq("status", "ACTIVE").select("id").maybeSingle()
    if (error) throw error
    if (!data) return NextResponse.json({ error: "Active fleet-to-business mapping was not found" }, { status: 404 })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[central payout route]", error)
    return NextResponse.json({ error: "Payout webhook route could not be saved" }, { status: 503 })
  }
}
