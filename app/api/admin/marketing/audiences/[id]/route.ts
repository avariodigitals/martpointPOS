import { NextResponse } from "next/server"
import { getSession, hasPermission } from "@/lib/admin-auth"
import type { UserRole } from "@/lib/admin-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { parseManualEmails, normalizeEmail, isValidEmail } from "@/lib/marketing"

async function guardMarketingAccess() {
  const session = await getSession()
  if (!session || !hasPermission(session.role as UserRole, "marketing")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  return null
}

/* ─── GET: audience detail + contacts ─── */
export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/admin/marketing/audiences/[id]">
) {
  const denied = await guardMarketingAccess()
  if (denied) return denied

  const { id } = await ctx.params

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 })
  }

  const { data: audience, error } = await supabase
    .from("marketing_audiences")
    .select("id, name, description, created_at")
    .eq("id", id)
    .single()

  if (error || !audience) {
    return NextResponse.json({ error: "Audience not found" }, { status: 404 })
  }

  const { data: contacts } = await supabase
    .from("marketing_contacts")
    .select("id, email, name, created_at")
    .eq("audience_id", id)
    .order("created_at", { ascending: true })

  return NextResponse.json({
    audience: { id: audience.id, name: audience.name, description: audience.description, createdAt: audience.created_at },
    contacts: contacts || [],
  })
}

/* ─── POST: add contacts to an audience ─── */
export async function POST(
  request: Request,
  ctx: RouteContext<"/api/admin/marketing/audiences/[id]">
) {
  const denied = await guardMarketingAccess()
  if (denied) return denied

  const { id } = await ctx.params

  try {
    const body = await request.json()
    const { contacts } = body

    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 500 })
    }

    const parsed = parseManualEmails(String(contacts || ""))
    if (parsed.length === 0) {
      return NextResponse.json({ error: "No valid emails provided" }, { status: 400 })
    }

    const { error } = await supabase.from("marketing_contacts").upsert(
      parsed.map((c) => ({ audience_id: id, email: c.email, name: c.name })),
      { onConflict: "audience_id,email" }
    )

    if (error) {
      console.error("[Marketing Contacts Upsert Error]", error)
      return NextResponse.json({ error: "Failed to add contacts" }, { status: 500 })
    }

    return NextResponse.json({ success: true, contactsAdded: parsed.length })
  } catch {
    return NextResponse.json({ error: "Failed to add contacts" }, { status: 500 })
  }
}

/* ─── DELETE: delete the audience, or one contact via ?contact=<email> ─── */
export async function DELETE(
  request: Request,
  ctx: RouteContext<"/api/admin/marketing/audiences/[id]">
) {
  const denied = await guardMarketingAccess()
  if (denied) return denied

  const { id } = await ctx.params

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 })
  }

  const { searchParams } = new URL(request.url)
  const contactEmail = normalizeEmail(searchParams.get("contact") || "")

  if (contactEmail) {
    if (!isValidEmail(contactEmail)) {
      return NextResponse.json({ error: "Invalid contact email" }, { status: 400 })
    }
    const { error } = await supabase
      .from("marketing_contacts")
      .delete()
      .eq("audience_id", id)
      .eq("email", contactEmail)
    if (error) {
      return NextResponse.json({ error: "Failed to remove contact" }, { status: 500 })
    }
    return NextResponse.json({ success: true })
  }

  const { error } = await supabase.from("marketing_audiences").delete().eq("id", id)
  if (error) {
    return NextResponse.json({ error: "Failed to delete audience" }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
