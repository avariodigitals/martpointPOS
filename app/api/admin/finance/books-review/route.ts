import { NextResponse } from "next/server"
import { authorizeAdmin } from "@/lib/admin-auth"
import { hasFinanceAction } from "@/lib/finance-permissions"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { runBooksReview } from "@/lib/books-review"
import { recordAudit, AUDIT_ACTIONS, AUDIT_ENTITIES, auditContextFromSession } from "@/lib/audit"

/* GET /api/admin/finance/books-review — review history + full latest row. */
export async function GET() {
  const { session, denied } = await authorizeAdmin("finance")
  if (denied) return denied
  if (!session || !hasFinanceAction(session.role, "finance:reports:view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Database not configured" }, { status: 500 })

  const { data, error } = await supabase
    .from("books_reviews")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(12)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ reviews: data || [] })
}

/* POST /api/admin/finance/books-review — run a new review. Body: { months?: number } */
export async function POST(request: Request) {
  const { session, denied } = await authorizeAdmin("finance")
  if (denied) return denied
  if (!session || !hasFinanceAction(session.role, "finance:reports:view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  let months = 12
  try {
    const body = (await request.json().catch(() => ({}))) as { months?: unknown }
    if (typeof body.months === "number" && body.months > 0 && body.months <= 36) months = Math.round(body.months)
  } catch {
    // default months
  }

  const result = await runBooksReview(months, session.userId)
  if (!result.ok) {
    return NextResponse.json({ error: result.error || "Books review failed", reviewId: result.reviewId }, { status: 500 })
  }

  await recordAudit(auditContextFromSession(session, request), {
    action: AUDIT_ACTIONS.FINANCE_BOOKS_REVIEW_COMPLETED,
    entityType: AUDIT_ENTITIES.BOOKS_REVIEW,
    entityId: result.reviewId || "unknown",
    metadata: { months },
  })

  return NextResponse.json({ success: true, reviewId: result.reviewId })
}
