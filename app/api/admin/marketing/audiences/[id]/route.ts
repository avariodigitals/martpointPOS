import { loadMarketingContacts } from "@/lib/marketing-contacts"
import { NextResponse } from "next/server"
import { getSession, hasPermissionForUser } from "@/lib/admin-auth"
import type { UserRole } from "@/lib/admin-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { parseManualEmails, normalizeEmail, isValidEmail } from "@/lib/marketing"
import { normalizeCommunicationPhone } from "@/lib/communications-policy"

async function guardMarketingAccess() {
  const session = await getSession()
  if (!session || !await hasPermissionForUser(session.userId, session.role as UserRole, "marketing")) {
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

  const { data: contacts, error: contactsError } = await loadMarketingContacts(id)
  if (contactsError) return NextResponse.json({ error: "Failed to load audience contacts" }, { status: 500 })

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
    const { contacts, phoneContacts, smsConsentConfirmed } = body

    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 500 })
    }

    // Structured CSV import: validate on the server; never alter suppression records.
    if (body.importContacts !== undefined) {
      if (!body.emailConsentConfirmed || !Array.isArray(body.importContacts) || !body.importContacts.length || body.importContacts.length > 5000) {
        return NextResponse.json({ error: "Confirm email permission and provide 1–5,000 contacts" }, { status: 400 })
      }
      const unique = new Map<string, { email: string; name: string }>()
      for (const contact of body.importContacts) {
        const email = normalizeEmail(String(contact?.email || ""))
        if (!isValidEmail(email) || /[<>]/.test(email)) return NextResponse.json({ error: "The import contains an invalid email address" }, { status: 400 })
        if (!unique.has(email)) unique.set(email, { email, name: String(contact?.name || "").trim().slice(0, 250) })
      }
      const { data: audience, error: audienceError } = await supabase.from("marketing_audiences").select("id").eq("id", id).maybeSingle()
      if (audienceError) return NextResponse.json({ error: "Unable to check audience" }, { status: 500 })
      if (!audience) return NextResponse.json({ error: "Audience not found" }, { status: 404 })
      const values = [...unique.values()]
      let added = 0
      for (let offset = 0; offset < values.length; offset += 250) {
        const { data, error } = await supabase.from("marketing_contacts").upsert(
          values.slice(offset, offset + 250).map(c => ({ audience_id: id, ...c })),
          { onConflict: "audience_id,email", ignoreDuplicates: true }
        ).select("id")
        if (error) return NextResponse.json({ error: `Import stopped after adding ${added} contacts. Retry safely: existing contacts are skipped.` }, { status: 500 })
        added += data?.length || 0
      }
      return NextResponse.json({ success: true, contactsAdded: added, duplicatesSkipped: body.importContacts.length - added })
    }

    const parsed = parseManualEmails(String(contacts || ""))
    const phones = String(phoneContacts || "").split(/[\n,;]+/).map((line) => {
      const value = line.trim()
      if (!value) return null
      const match = value.match(/^(.*?)<([^>]+)>\s*$/)
      const phone = normalizeCommunicationPhone(match ? match[2] : value)
      return phone ? { phone, name: match?.[1].trim() || "" } : null
    }).filter((item): item is { phone: string; name: string } => Boolean(item))
    if (String(phoneContacts || "").trim() && !smsConsentConfirmed) return NextResponse.json({ error: "Confirm SMS consent before adding phone numbers" }, { status: 400 })
    if (parsed.length === 0 && phones.length === 0) {
      return NextResponse.json({ error: "No valid emails provided" }, { status: 400 })
    }

    const { error } = parsed.length ? await supabase.from("marketing_contacts").upsert(
      parsed.map((c) => ({ audience_id: id, email: c.email, name: c.name })),
      { onConflict: "audience_id,email" }
    ) : { error: null }

    if (error) {
      console.error("[Marketing Contacts Upsert Error]", error)
      return NextResponse.json({ error: "Failed to add contacts" }, { status: 500 })
    }

    let smsContactsAdded = 0
    if (phones.length) {
      const unique = [...new Map(phones.map((phone) => [phone.phone, phone])).values()]
      const { error: phoneError, data } = await supabase.from("marketing_contacts").insert(unique.map((contact) => ({
        audience_id: id, email: null, phone: contact.phone, name: contact.name, sms_consent_at: new Date().toISOString(),
      }))).select("id")
      if (phoneError) return NextResponse.json({ error: "Could not save consented phone numbers" }, { status: 500 })
      smsContactsAdded = data?.length || 0
    }

    return NextResponse.json({ success: true, contactsAdded: parsed.length, smsContactsAdded })
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
  const contactId = searchParams.get("contactId") || ""

  if (contactId) {
    const { error } = await supabase.from("marketing_contacts").delete().eq("audience_id", id).eq("id", contactId)
    if (error) return NextResponse.json({ error: "Failed to remove contact" }, { status: 500 })
    return NextResponse.json({ success: true })
  }

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
