import { NextResponse } from "next/server"
import { authorizeAdmin } from "@/lib/admin-auth"
import { supabase } from "@/lib/supabase"
import { z } from "zod"

const schema = z.object({ fleetInstallId: z.number().int().positive(), storeId: z.number().int().positive(), installUrl: z.string().url().refine((v) => v.startsWith("https://"), "HTTPS installation URL required") })
const payoutEditSchema = z.object({ mappingId: z.string().uuid(), allowPayoutAccountEdit: z.boolean() })

export async function GET(_: Request, { params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params
  const auth = await authorizeAdmin("businesses", "view")
  if (auth.denied) return auth.denied
  const { data, error } = await supabase.from("central_installation_mappings").select("*").eq("business_id", businessId).order("created_at")
  if (error) return NextResponse.json({ error: "Installation mappings unavailable" }, { status: 503 })
  return NextResponse.json({ installations: data || [] })
}

export async function POST(request: Request, { params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params
  const auth = await authorizeAdmin("businesses", "manage")
  if (auth.denied) return auth.denied
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Provide a Central installation id, store id and HTTPS install URL" }, { status: 400 })
  const { data: existing } = await supabase.from("central_installation_mappings").select("business_id").eq("fleet_install_id", parsed.data.fleetInstallId).eq("store_id", parsed.data.storeId).maybeSingle()
  if (existing && existing.business_id !== businessId) return NextResponse.json({ error: "This Central installation and store are already mapped to another business" }, { status: 409 })
  const { data, error } = await supabase.from("central_installation_mappings").upsert({ business_id: businessId, fleet_install_id: parsed.data.fleetInstallId, store_id: parsed.data.storeId, install_url: parsed.data.installUrl, status: "ACTIVE", updated_at: new Date().toISOString() }, { onConflict: "fleet_install_id,store_id" }).select().single()
  if (error) return NextResponse.json({ error: "Installation mapping could not be saved" }, { status: 409 })
  return NextResponse.json({ installation: data })
}

export async function PATCH(request: Request, { params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params
  const auth = await authorizeAdmin("businesses", "manage")
  if (auth.denied) return auth.denied
  const parsed = payoutEditSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Provide a valid mapping and payout edit setting" }, { status: 400 })
  const { data, error } = await supabase.from("central_installation_mappings")
    .update({ allow_payout_account_edit: parsed.data.allowPayoutAccountEdit, updated_at: new Date().toISOString() })
    .eq("id", parsed.data.mappingId).eq("business_id", businessId).select("id,allow_payout_account_edit").maybeSingle()
  if (error || !data) return NextResponse.json({ error: "Payout account edit policy could not be saved" }, { status: 409 })
  return NextResponse.json({ success: true, allowPayoutAccountEdit: data.allow_payout_account_edit })
}
