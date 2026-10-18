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

export async function GET(request: Request) {
  const session = await requireSession()
  if (!session) return err("Forbidden", 403)

  if (!isSupabaseConfigured()) return ok([])

  const { searchParams } = new URL(request.url)
  const businessId = searchParams.get("business_id")
  const status = searchParams.get("status") // pending|sent|delivered|reviewed|failed
  const channel = searchParams.get("channel") // whatsapp|sms|email

  try {
    let query = supabase
      .from("azera_google_review_requests")
      .select("*")
      .order("created_at", { ascending: false })

    if (businessId) query = query.eq("business_id", businessId)
    if (status) query = query.eq("status", status)
    if (channel) query = query.eq("channel", channel)

    const { data, error } = await query.limit(200)

    if (error) return err(error.message, 500)

    return ok(data || [])
  } catch (e) {
    return err(String(e), 500)
  }
}

export async function POST(request: Request) {
  const session = await requireSession()
  if (!session) return err("Forbidden", 403)

  if (!isSupabaseConfigured()) return err("Supabase not configured", 500)

  try {
    const body = await request.json()
    const {
      business_id,
      conversation_id,
      customer_name,
      customer_phone,
      customer_email,
      channel = "whatsapp",
      google_place_id,
    } = body

    if (!business_id) return err("business_id is required")

    const now = new Date().toISOString()

    // Generate a Google review link
    const reviewLink = google_place_id
      ? `https://search.google.com/local/writereview?placeid=${google_place_id}`
      : null

    const { data, error } = await supabase
      .from("azera_google_review_requests")
      .insert({
        business_id,
        conversation_id,
        customer_name,
        customer_phone,
        customer_email,
        channel,
        status: "pending",
        google_place_id,
        review_link: reviewLink,
        created_at: now,
        updated_at: now,
      })
      .select()
      .single()

    if (error || !data) return err("Failed to create review request", 500)

    return ok(data)
  } catch (e) {
    return err(String(e), 500)
  }
}
