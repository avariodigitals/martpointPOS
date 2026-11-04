import { NextResponse } from "next/server"
import { getSession } from "@/lib/admin-auth"
import { hasFinanceActionForUser } from "@/lib/finance-permissions"
import { supabase } from "@/lib/supabase"

export const dynamic = "force-dynamic"

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!await hasFinanceActionForUser(session.userId, session.role, "finance:invoices:remind")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const { data, error } = await supabase.from("communication_templates")
    .select("id,name,body").eq("channel", "sms").order("created_at", { ascending: true })
  if (error) return NextResponse.json({ error: "Could not load SMS templates" }, { status: 503 })
  return NextResponse.json({ templates: data || [] })
}
