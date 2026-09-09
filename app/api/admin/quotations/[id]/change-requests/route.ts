import { NextResponse } from "next/server"
import { authorizeAdmin } from "@/lib/admin-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"

/* ─── GET: list change requests for a quotation ─── */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { denied } = await authorizeAdmin("quotations")
  if (denied) return denied

  const { id } = await params

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ changeRequests: [] })
  }

  try {
    const { data, error } = await supabase
      .from("lead_quote_change_requests")
      .select("*")
      .eq("quotation_id", id)
      .order("created_at", { ascending: false })

    if (error) throw error

    const changeRequests = (data || []).map((row: Record<string, unknown>) => ({
      id: row.id as string,
      quotation_id: row.quotation_id as string,
      request_type: row.request_type as "scope" | "counter_offer",
      payload: row.payload as Record<string, unknown>,
      client_note: (row.client_note as string | null) || null,
      status: row.status as "pending" | "approved" | "declined",
      admin_note: (row.admin_note as string | null) || null,
      resolved_by: (row.resolved_by as string | null) || null,
      resolved_at: (row.resolved_at as string | null) || null,
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
    }))

    return NextResponse.json({ changeRequests })
  } catch (e) {
    console.error("[admin/quotations/change-requests] GET", e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
