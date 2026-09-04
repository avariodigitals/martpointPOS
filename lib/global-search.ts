import { supabase, isSupabaseConfigured } from "./supabase"

export type SearchResult = {
  type: string
  id: string
  title: string
  subtitle: string
  href: string
}

const LIMIT = 8

async function searchBusinesses(q: string): Promise<SearchResult[]> {
  const { data, error } = await supabase
    .from("businesses")
    .select("id, business_name, primary_email, primary_phone")
    .or(`business_name.ilike.%${q}%,primary_email.ilike.%${q}%,primary_phone.ilike.%${q}%`)
    .limit(LIMIT)
  if (error || !data) return []
  return (data as any[]).map((b) => ({
    type: "Business",
    id: b.id,
    title: b.business_name,
    subtitle: b.primary_email || b.primary_phone || "",
    href: `/admin/businesses/${b.id}`,
  }))
}

async function searchLeads(q: string): Promise<SearchResult[]> {
  const { data, error } = await supabase
    .from("leads")
    .select("id, full_name, business_name, email, phone")
    .or(`full_name.ilike.%${q}%,business_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`)
    .limit(LIMIT)
  if (error || !data) return []
  return (data as any[]).map((l) => ({
    type: "Lead",
    id: l.id,
    title: l.full_name || l.business_name,
    subtitle: l.email || l.phone || "",
    href: `/admin/leads`,
  }))
}

async function searchPartners(q: string): Promise<SearchResult[]> {
  const { data, error } = await supabase
    .from("partners")
    .select("id, business_name, partner_code, country, state")
    .or(`business_name.ilike.%${q}%,partner_code.ilike.%${q}%`)
    .limit(LIMIT)
  if (error || !data) return []
  return (data as any[]).map((p) => ({
    type: "Partner",
    id: p.id,
    title: p.business_name,
    subtitle: `${p.partner_code} · ${p.country}${p.state ? ", " + p.state : ""}`,
    href: `/admin/partners/${p.id}`,
  }))
}

async function searchPartnerApplications(q: string): Promise<SearchResult[]> {
  const { data, error } = await supabase
    .from("partner_applications")
    .select("id, business_name, contact_email")
    .or(`business_name.ilike.%${q}%,contact_email.ilike.%${q}%`)
    .limit(LIMIT)
  if (error || !data) return []
  return (data as any[]).map((a) => ({
    type: "Partner Application",
    id: a.id,
    title: a.business_name,
    subtitle: a.contact_email,
    href: `/admin/partners/applications/${a.id}`,
  }))
}

async function searchPartnerLeads(q: string): Promise<SearchResult[]> {
  const { data, error } = await supabase
    .from("partner_leads")
    .select("id, business_name, contact_email")
    .or(`business_name.ilike.%${q}%,contact_email.ilike.%${q}%`)
    .limit(LIMIT)
  if (error || !data) return []
  return (data as any[]).map((l) => ({
    type: "Partner Lead",
    id: l.id,
    title: l.business_name,
    subtitle: l.contact_email,
    href: `/admin/partners/leads`,
  }))
}

async function searchInvoices(q: string): Promise<SearchResult[]> {
  const { data, error } = await supabase
    .from("invoices")
    .select("id, invoice_number, business_id")
    .or(`invoice_number.ilike.%${q}%`)
    .limit(LIMIT)
  if (error || !data) return []
  return (data as any[]).map((i) => ({
    type: "Invoice",
    id: i.id,
    title: i.invoice_number,
    subtitle: "Invoice",
    href: `/admin/finance`,
  }))
}

async function searchPayments(q: string): Promise<SearchResult[]> {
  const { data, error } = await supabase
    .from("payments")
    .select("id, payment_reference, receipt_number")
    .or(`payment_reference.ilike.%${q}%,receipt_number.ilike.%${q}%`)
    .limit(LIMIT)
  if (error || !data) return []
  return (data as any[]).map((p) => ({
    type: "Payment",
    id: p.id,
    title: p.payment_reference,
    subtitle: p.receipt_number ? `Receipt ${p.receipt_number}` : "Payment",
    href: `/admin/finance`,
  }))
}

async function searchSupportTickets(q: string): Promise<SearchResult[]> {
  const { data, error } = await supabase
    .from("support_tickets")
    .select("id, ticket_number, subject")
    .or(`ticket_number.ilike.%${q}%,subject.ilike.%${q}%`)
    .limit(LIMIT)
  if (error || !data) return []
  return (data as any[]).map((t) => ({
    type: "Support Ticket",
    id: t.id,
    title: t.ticket_number,
    subtitle: t.subject,
    href: `/admin/support/${t.id}`,
  }))
}

export async function globalSearch(q: string): Promise<SearchResult[]> {
  if (!isSupabaseConfigured() || !q.trim()) return []

  const [businesses, leads, partners, applications, partnerLeads, invoices, payments, tickets] = await Promise.all([
    searchBusinesses(q),
    searchLeads(q),
    searchPartners(q),
    searchPartnerApplications(q),
    searchPartnerLeads(q),
    searchInvoices(q),
    searchPayments(q),
    searchSupportTickets(q),
  ])

  return [
    ...businesses,
    ...leads,
    ...partners,
    ...applications,
    ...partnerLeads,
    ...invoices,
    ...payments,
    ...tickets,
  ]
}
