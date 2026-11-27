import { NextResponse } from "next/server"
import { getSession } from "@/lib/admin-auth"
import { supabase } from "@/lib/supabase"
import { renderPartnerGradingPolicyPdf } from "@/lib/partner-grading-policy-pdf.mjs"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.role !== "Admin") return NextResponse.json({ error: "Management access required" }, { status: 403 })

  const { data: policy, error } = await supabase.from("partner_grading_policies")
    .select("*").eq("status", "APPROVED").order("effective_at", { ascending: false }).limit(1).maybeSingle()
  if (error) return NextResponse.json({ error: "Could not load the approved policy" }, { status: 500 })
  if (!policy) return NextResponse.json({ error: "No approved policy is published" }, { status: 404 })

  let approvedByName = String(policy.approved_by_name || "").trim()
  if (!approvedByName && policy.approved_by) {
    const { data: approver } = await supabase.from("users").select("name,username").eq("id", policy.approved_by).maybeSingle()
    approvedByName = String(approver?.name || approver?.username || "").trim()
  }
  if (!approvedByName || !(policy.approved_at || policy.effective_at) || !policy.effective_at) {
    return NextResponse.json({ error: "The policy approval record is incomplete. Contact Partner Operations." }, { status: 409 })
  }

  const bytes = renderPartnerGradingPolicyPdf({ ...policy, approved_by_name: approvedByName, approved_at: policy.approved_at || policy.effective_at })
  return new Response(bytes, {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="MartPoint-Partner-Performance-Grading-Policy-v${String(policy.version).replace(/[^a-zA-Z0-9._-]/g, "-")}.pdf"`,
      "cache-control": "private, no-store",
    },
  })
}
