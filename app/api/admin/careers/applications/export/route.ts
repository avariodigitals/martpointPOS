import { NextResponse } from "next/server"
import { authorizeAdmin } from "@/lib/admin-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { recordAudit, auditContextFromSession, AUDIT_ACTIONS, AUDIT_ENTITIES } from "@/lib/audit"

export const dynamic = "force-dynamic"

function csvCell(v: unknown): string {
  const s = v == null ? "" : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/* GET: CSV export of applications, honouring the caller's active filters.
 * Requires careers.applications.export. */
export async function GET(request: Request) {
  const { session, denied } = await authorizeAdmin("careers.applications.export")
  if (denied) return denied
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Database not configured" }, { status: 503 })

  const { searchParams } = new URL(request.url)
  const status = searchParams.get("status")
  const vacancyId = searchParams.get("vacancyId")
  const state = searchParams.get("state")

  let query = supabase
    .from("career_applications")
    .select("reference_number, full_name, email, phone, state, lga, city, status, review_score, screening_score, source, submitted_at, career_vacancies(title, reference_number)")
    .order("submitted_at", { ascending: false })
    .limit(5000)

  if (status) query = query.eq("status", status)
  if (vacancyId) query = query.eq("vacancy_id", vacancyId)
  if (state) query = query.eq("state", state)
  if (session.role === "Hiring Manager") {
    const { data: vIds } = await supabase.from("career_vacancies").select("id").eq("hiring_manager_id", session.userId)
    const ids = (vIds || []).map((v) => v.id)
    if (ids.length === 0) query = query.eq("vacancy_id", "00000000-0000-0000-0000-000000000000")
    else query = query.in("vacancy_id", ids)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: "Export failed" }, { status: 500 })

  const header = ["Reference", "Vacancy", "Vacancy Ref", "Name", "Email", "Phone", "State", "LGA", "City", "Status", "Review Score", "Screening Score", "Source", "Submitted"]
  const rows = (data || []).map((r) => {
    const vac = r.career_vacancies as { title?: string; reference_number?: string } | null
    return [
      r.reference_number, vac?.title || "", vac?.reference_number || "",
      r.full_name, r.email, r.phone, r.state || "", r.lga || "", r.city || "",
      r.status, r.review_score ?? "", r.screening_score ?? "", r.source || "",
      r.submitted_at,
    ]
  })
  const csv = [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\n")

  await recordAudit(auditContextFromSession(session, request), {
    action: AUDIT_ACTIONS.CAREER_APPLICATIONS_EXPORTED,
    entityType: AUDIT_ENTITIES.CAREER_APPLICATION,
    entityId: null,
    metadata: { rows: rows.length, filters: { status, vacancyId, state } },
  })

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="career-applications-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  })
}
