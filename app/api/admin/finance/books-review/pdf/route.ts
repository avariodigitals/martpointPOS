import { NextResponse } from "next/server"
import { authorizeAdmin } from "@/lib/admin-auth"
import { hasFinanceAction } from "@/lib/finance-permissions"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { generateBooksReviewPdf } from "@/lib/books-report-pdf"

/* GET /api/admin/finance/books-review/pdf?id= — downloads the stored report as a PDF. */
export async function GET(request: Request) {
  const { session, denied } = await authorizeAdmin("finance")
  if (denied) return denied
  if (!session || !hasFinanceAction(session.role, "finance:reports:view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Database not configured" }, { status: 500 })

  const id = new URL(request.url).searchParams.get("id")
  if (!id) return NextResponse.json({ error: "Review ID required" }, { status: 400 })

  const { data: row, error } = await supabase.from("books_reviews").select("*").eq("id", id).single()
  if (error || !row) return NextResponse.json({ error: error?.message || "Review not found" }, { status: 404 })

  const pdf = generateBooksReviewPdf({
    created_at: row.created_at,
    months: row.months,
    status: row.status,
    model: row.model,
    health_score: row.health_score,
    verdict: row.verdict,
    metrics: row.metrics,
    findings: row.findings,
    narrative: row.narrative,
  })

  const date = String(row.created_at).slice(0, 10)
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="MartPoint-Books-Review-${date}.pdf"`,
    },
  })
}
