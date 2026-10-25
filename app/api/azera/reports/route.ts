import { NextResponse } from "next/server"
import { getSession, hasPermission } from "@/lib/admin-auth"
import { supabase } from "@/lib/supabase"
import { callReportFilters } from "@/lib/azera-reporting"
export async function GET(request: Request) {
  const session = await getSession()
  if (!session || !hasPermission(session.role, "azera"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  let filters
  try {
    filters = callReportFilters(new URL(request.url).searchParams)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid filters" },
      { status: 400 }
    )
  }
  try {
    let query = supabase
      .from("azera_calls")
      .select(
        "id,business_id,call_type,direction,status,agent_user_id,agent_name,customer_name,customer_phone,selected_department,follow_up_status,follow_up_notes,follow_up_at,provider_cost_amount,provider_cost_currency,started_at,answered_at,ended_at,duration_seconds,created_at",
        { count: "exact" }
      )
      .gte("created_at", filters.from)
      .lt("created_at", filters.to)
      .order("created_at", { ascending: false })
      .order("id", { ascending: true })
    if (filters.type) query = query.eq("call_type", filters.type)
    if (filters.direction) query = query.eq("direction", filters.direction)
    if (filters.status) query = query.eq("status", filters.status)
    if (filters.search)
      query = query.or(
        `customer_name.ilike.%${filters.search}%,customer_phone.ilike.%${filters.search}%,agent_name.ilike.%${filters.search}%`
      )
    const start = (filters.page - 1) * filters.pageSize
    const [rows, summary] = await Promise.all([
      query.range(start, start + filters.pageSize - 1),
      supabase.rpc("azera_call_report_summary", {
        p_from: filters.from,
        p_to: filters.to,
        p_type: filters.type,
        p_direction: filters.direction,
        p_status: filters.status,
        p_search: filters.search,
      }),
    ])
    if (rows.error || summary.error)
      return NextResponse.json(
        {
          error:
            "Call reporting is unavailable. Apply migration 134 and retry; totals are not being shown as zero.",
        },
        { status: 503 }
      )
    return NextResponse.json(
      {
        calls: rows.data || [],
        count: rows.count || 0,
        page: filters.page,
        pageSize: filters.pageSize,
        summary: summary.data,
      },
      { headers: { "Cache-Control": "no-store" } }
    )
  } catch {
    return NextResponse.json(
      { error: "Call reporting is temporarily unavailable." },
      { status: 503 }
    )
  }
}
