import { NextResponse } from "next/server"
import { authorizeAdmin } from "@/lib/admin-auth"
import { hasFinanceAction } from "@/lib/finance-permissions"
import { createSignedDocUrl } from "@/lib/partner-documents"
import { isSupabaseConfigured, supabase } from "@/lib/supabase"

export async function GET(request: Request) {
  const { session, denied } = await authorizeAdmin("finance")
  if (denied) return denied
  if (!session || !hasFinanceAction(session.role, "finance:payments:view")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Not configured" }, { status: 503 })

  const id = new URL(request.url).searchParams.get("id")
  if (!id) return NextResponse.json({ error: "Payment ID required" }, { status: 400 })
  const { data: payment } = await supabase.from("payments").select("proof_document_path").eq("id", id).maybeSingle()
  if (!payment?.proof_document_path) return NextResponse.json({ error: "No proof attached" }, { status: 404 })

  const url = await createSignedDocUrl(payment.proof_document_path as string, 300)
  if (!url) return NextResponse.json({ error: "Proof unavailable" }, { status: 404 })
  return NextResponse.redirect(url)
}
