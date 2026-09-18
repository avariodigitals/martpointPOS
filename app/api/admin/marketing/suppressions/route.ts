import { NextResponse } from "next/server"
import { getSession, hasPermission } from "@/lib/admin-auth"
import type { UserRole } from "@/lib/admin-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { normalizeEmail, isValidEmail } from "@/lib/marketing"

async function guardMarketingAccess() {
  const session = await getSession()
  if (!session || !hasPermission(session.role as UserRole, "marketing")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  return null
}

/* ─── GET: suppression (unsubscribe) list ─── */
export async function GET() {
  const denied = await guardMarketingAccess()
  if (denied) return denied

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ suppressions: [] })
  }

  const { data, error } = await supabase
    .from("marketing_unsubscribes")
    .select("email, source, created_at")
    .order("created_at", { ascending: false })

  if (error) {
    console.error("[Marketing Suppressions GET Error]", error)
    return NextResponse.json({ error: "Failed to fetch suppressions" }, { status: 500 })
  }

  return NextResponse.json({
    suppressions: (data || []).map((r) => ({
      email: r.email,
      source: r.source,
      createdAt: r.created_at,
    })),
  })
}

/* ─── POST: manually suppress an email ─── */
export async function POST(request: Request) {
  const denied = await guardMarketingAccess()
  if (denied) return denied

  try {
    const body = await request.json()
    const email = normalizeEmail(String(body?.email || ""))

    if (!isValidEmail(email)) {
      return NextResponse.json({ error: "Valid email is required" }, { status: 400 })
    }

    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 500 })
    }

    const { error } = await supabase
      .from("marketing_unsubscribes")
      .upsert({ email, source: "admin" }, { onConflict: "email" })

    if (error) {
      console.error("[Marketing Suppression Insert Error]", error)
      return NextResponse.json({ error: "Failed to add suppression" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Failed to add suppression" }, { status: 500 })
  }
}

/* ─── DELETE: remove a suppression (resubscribe) ─── */
export async function DELETE(request: Request) {
  const denied = await guardMarketingAccess()
  if (denied) return denied

  const { searchParams } = new URL(request.url)
  const email = normalizeEmail(searchParams.get("email") || "")

  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Valid email is required" }, { status: 400 })
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 })
  }

  const { error } = await supabase.from("marketing_unsubscribes").delete().eq("email", email)
  if (error) {
    return NextResponse.json({ error: "Failed to remove suppression" }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
