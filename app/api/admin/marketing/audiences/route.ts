import { NextResponse } from "next/server"
import crypto from "crypto"
import { getSession, hasPermission } from "@/lib/admin-auth"
import type { UserRole } from "@/lib/admin-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { parseManualEmails } from "@/lib/marketing"

async function guardMarketingAccess() {
  const session = await getSession()
  if (!session || !hasPermission(session.role as UserRole, "marketing")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  return null
}

/* ─── GET: audiences with contact counts ─── */
export async function GET() {
  const denied = await guardMarketingAccess()
  if (denied) return denied

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ audiences: [] })
  }

  const { data: audiences, error } = await supabase
    .from("marketing_audiences")
    .select("id, name, description, created_at")
    .order("created_at", { ascending: false })

  if (error) {
    console.error("[Marketing Audiences GET Error]", error)
    return NextResponse.json({ error: "Failed to fetch audiences" }, { status: 500 })
  }

  const { data: contacts } = await supabase
    .from("marketing_contacts")
    .select("audience_id")

  const counts = new Map<string, number>()
  for (const c of contacts || []) {
    counts.set(c.audience_id, (counts.get(c.audience_id) || 0) + 1)
  }

  return NextResponse.json({
    audiences: (audiences || []).map((a) => ({
      id: a.id,
      name: a.name,
      description: a.description,
      createdAt: a.created_at,
      contactCount: counts.get(a.id) || 0,
    })),
  })
}

/* ─── POST: create audience + bulk contacts ─── */
export async function POST(request: Request) {
  const denied = await guardMarketingAccess()
  if (denied) return denied

  try {
    const body = await request.json()
    const { name, description, contacts } = body

    if (!name || !String(name).trim()) {
      return NextResponse.json({ error: "Audience name is required" }, { status: 400 })
    }

    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 500 })
    }

    const audienceId = crypto.randomUUID()
    const { error } = await supabase.from("marketing_audiences").insert({
      id: audienceId,
      name: String(name).trim(),
      description: String(description || "").trim(),
    })

    if (error) {
      console.error("[Marketing Audience Insert Error]", error)
      return NextResponse.json({ error: "Failed to create audience" }, { status: 500 })
    }

    const parsed = parseManualEmails(String(contacts || ""))
    if (parsed.length) {
      const { error: contactsError } = await supabase.from("marketing_contacts").insert(
        parsed.map((c) => ({ audience_id: audienceId, email: c.email, name: c.name }))
      )
      if (contactsError) {
        console.error("[Marketing Contacts Insert Error]", contactsError)
      }
    }

    return NextResponse.json({ success: true, id: audienceId, contactsAdded: parsed.length })
  } catch {
    return NextResponse.json({ error: "Failed to create audience" }, { status: 500 })
  }
}
