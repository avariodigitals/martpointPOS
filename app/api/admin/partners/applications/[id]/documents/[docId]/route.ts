import { NextResponse } from "next/server"
import { authorizeAdmin } from "@/lib/admin-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { createSignedDocUrl } from "@/lib/partner-documents"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; docId: string }> },
) {
  const { denied } = await authorizeAdmin("partners", "view")
  if (denied) return denied
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Not configured" }, { status: 500 })

  const { id, docId } = await params
  const { data: document, error } = await supabase
    .from("partner_documents")
    .select("storage_path")
    .eq("id", docId)
    .eq("application_id", id)
    .maybeSingle()

  if (error || !document?.storage_path) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 })
  }

  const signedUrl = await createSignedDocUrl(document.storage_path as string, 300)
  if (!signedUrl) return NextResponse.json({ error: "Could not generate document link" }, { status: 500 })
  return NextResponse.json({ signedUrl })
}
