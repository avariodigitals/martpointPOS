import { supabase } from "@/lib/supabase"

export type RequesterType = "lead" | "business" | "creator" | "partner"
export type SupportRequester = {
  type: RequesterType
  id: string
  name: string
  contactName?: string
  email: string
  href: string
}
export const REQUESTER_FIELDS = {
  lead: "lead_id",
  business: "business_id",
  creator: "creator_id",
  partner: "requester_partner_id"
} as const

export function requesterHref(type: RequesterType, id: string) {
  return type === "lead"
    ? `/admin/leads?lead=${id}`
    : type === "creator"
      ? `/admin/creators/creators/${id}`
      : `/admin/${type === "partner" ? "partners" : "businesses"}/${id}`
}

export async function getSupportRequester(type: RequesterType, id: string): Promise<SupportRequester | null> {
  const table = { lead: "leads", business: "businesses", creator: "creators", partner: "partners" }[type]
  const columns = {
    lead: "id,full_name,email",
    business: "id,business_name,primary_contact_name,primary_email",
    creator: "id,full_name,email",
    partner: "id,business_name,display_name,public_email"
  }[type]
  const { data, error } = await supabase.from(table).select(columns).eq("id", id).maybeSingle()
  if (error) throw new Error("Could not load the ticket requester")
  if (!data) return null
  const row = data as unknown as Record<string, string>
  let email = row.email || row.primary_email || row.public_email || ""
  if (type === "partner" && !email) {
    const { data: owner } = await supabase
      .from("partner_users")
      .select("email")
      .eq("partner_id", id)
      .eq("role", "PARTNER_OWNER")
      .eq("status", "ACTIVE")
      .limit(1)
      .maybeSingle()
    email = owner?.email || ""
  }
  return {
    type,
    id,
    name: row.full_name || row.display_name || row.business_name || "Contact",
    contactName: row.primary_contact_name || row.full_name,
    email,
    href: requesterHref(type, id)
  }
}

/** A public visitor with no existing profile becomes a support-origin lead. */
export async function resolveChatTicketRequester(input: {
  name?: string | null
  email?: string | null
  phone?: string | null
}): Promise<SupportRequester> {
  const email = input.email?.trim().toLowerCase() || ""
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new Error("Please provide an email address so we can attach and follow up on your ticket")
  for (const type of ["creator", "business", "lead"] as const) {
    const table = type === "creator" ? "creators" : type === "business" ? "businesses" : "leads"
    const column = type === "business" ? "primary_email" : "email"
    const { data, error } = await supabase.from(table).select("id").ilike(column, email).limit(2)
    if (error) throw new Error("Could not match the ticket contact")
    if (data?.length === 1) {
      const requester = await getSupportRequester(type, data[0].id)
      if (requester && !(type === "business" && requester.name.toLowerCase() === "martpoint support"))
        return requester
    }
  }
  const { data: partnerUser, error: partnerError } = await supabase
    .from("partner_users")
    .select("partner_id")
    .ilike("email", email)
    .limit(1)
    .maybeSingle()
  if (partnerError) throw new Error("Could not match the partner contact")
  if (partnerUser) {
    const requester = await getSupportRequester("partner", partnerUser.partner_id)
    if (requester) return { ...requester, name: input.name?.trim() || requester.name, email }
  }
  const { data, error } = await supabase
    .from("leads")
    .insert({
      full_name: input.name?.trim() || email,
      business_name: "",
      email,
      phone: input.phone?.trim() || "",
      business_type: "",
      product_interest: "",
      branches: "",
      staff_size: "",
      source: "Support enquiry",
      status: "New"
    })
    .select("id")
    .single()
  if (error || !data) throw new Error("Could not create the support contact profile")
  return {
    type: "lead",
    id: data.id,
    name: input.name?.trim() || email,
    email,
    href: requesterHref("lead", data.id)
  }
}
