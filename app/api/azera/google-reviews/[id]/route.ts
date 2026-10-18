import { NextResponse } from "next/server"
import { getSession, hasPermission } from "@/lib/admin-auth"
import type { SessionPayload, UserRole } from "@/lib/admin-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"

async function requireSession(): Promise<SessionPayload | null> {
  const session = await getSession()
  if (!session || !hasPermission(session.role as UserRole, "support")) {
    return null
  }
  return session
}

function ok<T>(data: T) {
  return NextResponse.json({ success: true, data })
}
function err(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status })
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSession()
  if (!session) return err("Forbidden", 403)

  const { id } = await params

  if (!isSupabaseConfigured()) return err("Supabase not configured", 500)

  try {
    const { data, error } = await supabase
      .from("azera_google_review_requests")
      .select("*")
      .eq("id", id)
      .single()

    if (error || !data) return err("Review request not found", 404)

    return ok(data)
  } catch (e) {
    return err(String(e), 500)
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSession()
  if (!session) return err("Forbidden", 403)

  const { id } = await params

  if (!isSupabaseConfigured()) return err("Supabase not configured", 500)

  try {
    const body = await request.json()
    const {
      status,
      review_rating,
      review_text,
      reviewed_at,
    } = body

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (status !== undefined) updates.status = status
    if (review_rating !== undefined) updates.review_rating = review_rating
    if (review_text !== undefined) updates.review_text = review_text
    if (reviewed_at !== undefined) updates.reviewed_at = reviewed_at

    const { data, error } = await supabase
      .from("azera_google_review_requests")
      .update(updates)
      .eq("id", id)
      .select()
      .single()

    if (error || !data) return err("Failed to update review request", 500)

    return ok(data)
  } catch (e) {
    return err(String(e), 500)
  }
}
