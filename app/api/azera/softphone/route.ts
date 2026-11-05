import { NextResponse } from "next/server"
import { getSession, hasPermissionForUser } from "@/lib/admin-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { normalizeDialNumber } from "@/lib/browser-phone-target"

export const dynamic = "force-dynamic"

function selectedRange(period: string | null) {
  const allowed = ["today", "last_7_days", "this_month", "last_month", "last_30_days", "this_year"]
  const choice = allowed.includes(period || "") ? period! : "this_month"
  const lagosNow = new Date(Date.now() + 60 * 60 * 1000)
  const year = lagosNow.getUTCFullYear()
  const month = lagosNow.getUTCMonth()
  const start = choice === "today"
    ? new Date(Date.UTC(year, month, lagosNow.getUTCDate()) - 60 * 60 * 1000)
    : choice === "last_7_days"
      ? new Date(Date.now() - 7 * 86_400_000)
      : choice === "last_30_days"
    ? new Date(Date.now() - 30 * 86_400_000)
    : new Date(Date.UTC(year, choice === "this_year" ? 0 : choice === "last_month" ? month - 1 : month, 1) - 60 * 60 * 1000)
  const end = choice === "last_month"
    ? new Date(Date.UTC(year, month, 1) - 60 * 60 * 1000)
    : new Date()
  return { period: choice, from: start.toISOString(), to: end.toISOString() }
}

export async function GET(request: Request) {
  const session = await getSession()
  if (!session || !await hasPermissionForUser(session.userId, session.role, "azera"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Phone workspace is unavailable" }, { status: 503 })

  const range = selectedRange(new URL(request.url).searchParams.get("period"))
  const loadCalls = async () => {
    const rows: { id: string; lead_id: string | null; direction: string; status: string; customer_name: string | null; customer_phone: string | null; agent_name: string | null; duration_seconds: number | null; created_at: string; started_at: string | null; answered_at: string | null; ended_at: string | null }[] = []
    for (let offset = 0; offset < 10_000; offset += 1000) {
      const page = await supabase.from("azera_calls")
        .select("id,lead_id,direction,status,customer_name,customer_phone,agent_name,duration_seconds,created_at,started_at,answered_at,ended_at")
        .eq("agent_user_id", session.userId).gte("created_at", range.from).lt("created_at", range.to)
        .order("created_at", { ascending: false }).range(offset, offset + 999)
      if (page.error) return { data: null, error: page.error }
      rows.push(...(page.data || []))
      if ((page.data || []).length < 1000) break
    }
    return { data: rows, error: null }
  }
  const calls = await loadCalls()
  if (calls.error) {
    console.error("[Azera softphone workspace lookup failed]", calls.error)
    return NextResponse.json({ error: "Your phone workspace could not load. Please try again." }, { status: 503 })
  }

  const records = calls.data || []
  const inboundCalls = records.filter(call => call.direction === "inbound")
  const outboundCalls = records.filter(call => call.direction === "outbound")
  const missedCalls = inboundCalls.filter(call => ["missed", "no_answer", "busy", "failed"].includes(call.status))
  const callStats = {
    total: records.length,
    inbound: inboundCalls.length,
    outbound: outboundCalls.length,
    missed: missedCalls.length,
    minutes: Math.round(records.reduce((sum, call) => sum + (Number(call.duration_seconds) || 0), 0) / 60),
    inboundMinutes: Math.round(inboundCalls.reduce((sum, call) => sum + (Number(call.duration_seconds) || 0), 0) / 60),
    outboundMinutes: Math.round(outboundCalls.reduce((sum, call) => sum + (Number(call.duration_seconds) || 0), 0) / 60),
    unansweredPercent: inboundCalls.length ? Math.round(missedCalls.length / inboundCalls.length * 100) : 0,
  }

  type PhonebookContact = { id: string; name: string; phone: string; email: string | null; group: string; groupId: string; source: "marketing" | "lead" | "business" | "creator" | "partner" | "partner_lead"; linkedLeadId?: string | null }
  const phonebook: { groups: { id: string; name: string; count: number }[]; contacts: PhonebookContact[] } = { groups: [], contacts: [] }
  const [canManageAudiences, canViewLeads, canViewBusinesses, canViewCreators, canViewPartners] = await Promise.all([
    hasPermissionForUser(session.userId, session.role, "marketing"),
    hasPermissionForUser(session.userId, session.role, "leads"),
    hasPermissionForUser(session.userId, session.role, "businesses"),
    hasPermissionForUser(session.userId, session.role, "creator.view"),
    hasPermissionForUser(session.userId, session.role, "partners"),
  ])

  if (canManageAudiences) {
    const [audiences, contacts] = await Promise.all([
      supabase.from("marketing_audiences").select("id,name").order("name"),
      supabase.from("marketing_contacts").select("id,audience_id,name,phone,email,sms_consent_at")
        .order("name").limit(500),
    ])
    if (!audiences.error && !contacts.error) {
      const names = new Map((audiences.data || []).map(group => [group.id, group.name]))
      const counts = new Map<string, number>()
      for (const contact of contacts.data || []) {
        if (!contact.phone && !contact.email) continue
        const group = names.get(contact.audience_id) || "Ungrouped"
        const groupId = contact.audience_id || "ungrouped"
        counts.set(groupId, (counts.get(groupId) || 0) + 1)
        phonebook.contacts.push({ id: contact.id, name: contact.name || contact.phone || contact.email || "Contact", phone: contact.phone || "", email: contact.email || null, group, groupId, source: "marketing" })
      }
      phonebook.groups.push(...(audiences.data || []).map(group => ({ id: group.id, name: group.name, count: counts.get(group.id) || 0 })))
      if (counts.has("ungrouped")) phonebook.groups.push({ id: "ungrouped", name: "Ungrouped", count: counts.get("ungrouped") || 0 })
    }
  }

  // Load businesses for display and to identify converted leads even for staff
  // whose role can view leads but not the Businesses section.
  const shouldLoadBusinesses = canViewBusinesses || canViewLeads || canViewPartners
  const businessesResult = shouldLoadBusinesses
    ? await supabase.from("businesses").select("id,business_name,primary_contact_name,primary_phone,primary_email,source_lead_id,partner_lead_id").order("business_name").limit(1000)
    : { data: [], error: null }
  const businesses = businessesResult.error ? [] : businessesResult.data || []
  const businessIds = new Set(businesses.map(business => business.id))
  const convertedLeadIds = new Set(businesses.map(business => business.source_lead_id).filter((id): id is string => Boolean(id)))
  const convertedPartnerLeadIds = new Set(businesses.map(business => business.partner_lead_id).filter((id): id is string => Boolean(id)))

  let leads: { id: string; full_name: string; business_name: string; phone: string; email: string; additional_email?: string | null }[] = []
  if (canViewLeads) {
    const result = await supabase.from("leads").select("id,full_name,business_name,phone,email,additional_email")
      .order("submitted_at", { ascending: false }).limit(1000)
    if (!result.error) {
      leads = (result.data || []).filter(lead => Boolean(lead.phone || lead.email || lead.additional_email))
        .filter(lead => !convertedLeadIds.has(lead.id)) as typeof leads
      phonebook.contacts.push(...leads.map(lead => ({ id: lead.id, name: lead.full_name || lead.business_name || lead.phone || "Lead", phone: lead.phone || "", email: lead.email || lead.additional_email || null, group: "Leads", groupId: "leads", source: "lead" as const })))
    }
  }

  if (canViewBusinesses && !businessesResult.error) {
    const contacts = businesses.filter(business => Boolean(business.primary_phone || business.primary_email))
    phonebook.contacts.push(...contacts.map(business => ({
      id: business.id,
      name: business.primary_contact_name || business.business_name || business.primary_phone || "Business",
      phone: business.primary_phone || "",
      email: business.primary_email || null,
      group: "Businesses",
      groupId: "businesses",
      source: "business" as const,
      linkedLeadId: business.source_lead_id || null,
    })))
  }

  if (canViewCreators) {
    const { data: creators, error } = await supabase.from("creators")
      .select("id,full_name,email,phone,status").neq("status", "REMOVED").order("full_name").limit(500)
    if (!error) phonebook.contacts.push(...(creators || []).filter(creator => Boolean(creator.phone || creator.email)).map(creator => ({
      id: creator.id, name: creator.full_name || creator.phone || "Creator", phone: creator.phone || "", email: creator.email || null,
      group: "Creators", groupId: "creators", source: "creator" as const,
    })))
  }

  if (canViewPartners) {
    const { data: partners, error } = await supabase.from("partners")
      .select("id,application_id,business_name,display_name,public_phone,public_email,status")
      .neq("status", "TERMINATED").order("display_name").limit(500)
    if (!error) {
      const applicationIds = [...new Set((partners || []).map(partner => partner.application_id).filter((id): id is string => Boolean(id)))]
      const applications = applicationIds.length
        ? await supabase.from("partner_applications").select("id,full_name,email,phone").in("id", applicationIds)
        : { data: [], error: null }
      const applicationById = new Map((applications.data || []).map(application => [application.id, application]))
      phonebook.contacts.push(...(partners || []).map(partner => {
        const application = partner.application_id ? applicationById.get(partner.application_id) : null
        const phone = partner.public_phone || application?.phone || ""
        const email = partner.public_email || application?.email || null
        return { partner, phone, email, name: partner.display_name || partner.business_name || application?.full_name || phone || "Partner" }
      }).filter(row => Boolean(row.phone || row.email)).map(({ partner, phone, email, name }) => ({
        id: partner.id, name, phone, email, group: "Partners", groupId: "partners", source: "partner" as const,
      })))
    }
  }

  if (canViewPartners) {
    const { data: partnerLeads, error } = await supabase.from("partner_leads")
      .select("id,business_name,contact_name,phone,email,matched_lead_id,matched_business_id,converted_business_id")
      .order("created_at", { ascending: false }).limit(1000)
    if (!error) {
      const canonicalLeadIds = new Set(leads.map(lead => lead.id))
      const pendingPartnerLeads = (partnerLeads || []).filter(lead => Boolean(lead.phone || lead.email))
        .filter(lead => !lead.converted_business_id && !convertedPartnerLeadIds.has(lead.id))
        .filter(lead => !lead.matched_business_id || !businessIds.has(lead.matched_business_id))
        .filter(lead => !lead.matched_lead_id || (!canonicalLeadIds.has(lead.matched_lead_id) && !convertedLeadIds.has(lead.matched_lead_id)))
      phonebook.contacts.push(...pendingPartnerLeads.map(lead => ({
        id: lead.id, name: lead.contact_name || lead.business_name || lead.phone || "Partner lead", phone: lead.phone || "", email: lead.email || null,
        group: "Leads", groupId: "leads", source: "partner_lead" as const,
      })))
    }
  }

  const groupSpecs = [
    { id: "leads", name: "Leads" }, { id: "businesses", name: "Businesses" },
    { id: "creators", name: "Creators" }, { id: "partners", name: "Partners" },
  ]
  for (const group of groupSpecs) {
    const count = phonebook.contacts.filter(contact => contact.groupId === group.id).length
    if (count) phonebook.groups.push({ ...group, count })
  }

  const byPhone = new Map<string, { name: string; priority: number }>()
  const byLeadId = new Map<string, { name: string; priority: number }>()
  const contactPriority = (contact: PhonebookContact) => contact.source === "business" ? 6 : contact.source === "lead" ? 5 : contact.source === "partner_lead" ? 4 : 2
  for (const contact of phonebook.contacts) {
    const priority = contactPriority(contact)
    if (contact.phone) {
      const normalized = normalizeDialNumber(contact.phone)
      for (const key of new Set([contact.phone, normalized, normalized?.replace(/^\+/, "")].filter((value): value is string => Boolean(value)))) {
        const existing = byPhone.get(key)
        if (!existing || priority > existing.priority) byPhone.set(key, { name: contact.name, priority })
      }
    }
    if (contact.source === "lead") byLeadId.set(contact.id, { name: contact.name, priority })
    if (contact.source === "business" && contact.linkedLeadId) {
      const existing = byLeadId.get(contact.linkedLeadId)
      if (!existing || priority > existing.priority) byLeadId.set(contact.linkedLeadId, { name: contact.name, priority })
    }
  }
  const resolvedCalls = records.slice(0, 100).map(call => {
    const normalized = call.customer_phone ? normalizeDialNumber(call.customer_phone) : null
    const name = (call.lead_id ? byLeadId.get(call.lead_id)?.name : null)
      || (normalized ? byPhone.get(normalized)?.name : null)
      || call.customer_name
    return { ...call, customer_name: name }
  })

  return NextResponse.json({ calls: resolvedCalls, callStats, period: range.period, phonebook }, { headers: { "Cache-Control": "no-store" } })
}
