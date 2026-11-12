import { NextResponse } from "next/server"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { verifyCentralRequest } from "@/lib/central-billing-auth"

export async function POST(request: Request) {
  const raw = await request.text()
  if (!verifyCentralRequest(request.headers.get("x-central-timestamp") || "", raw, request.headers.get("x-central-signature") || "", new URL(request.url).pathname)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Central billing is unavailable" }, { status: 503 })
  try {
    const body = JSON.parse(raw) as { fleet_install_id: number; install_url: string; store_id: number }
    if (!Number.isSafeInteger(body.fleet_install_id) || body.fleet_install_id < 1 || !/^https:\/\//.test(body.install_url || "") || !Number.isSafeInteger(body.store_id) || body.store_id < 1) return NextResponse.json({ error: "Invalid fleet payout policy request" }, { status: 400 })
    const installUrl = body.install_url.replace(/\/$/, "")
    const { data, error } = await supabase.from("central_installation_mappings")
      .select("allow_payout_account_edit")
      .eq("fleet_install_id", body.fleet_install_id)
      .in("install_url", [installUrl, `${installUrl}/`])
      .eq("store_id", body.store_id).eq("status", "ACTIVE").maybeSingle()
    if (error) throw error
    if (!data) return NextResponse.json({ error: "Active fleet-to-business mapping was not found" }, { status: 404 })
    return NextResponse.json({ success: true, allow_payout_account_edit: data.allow_payout_account_edit === true })
  } catch (error) {
    console.error("[central payout policy]", error)
    return NextResponse.json({ error: "Payout account policy could not be read" }, { status: 503 })
  }
}
