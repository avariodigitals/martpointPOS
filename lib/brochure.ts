import crypto from "crypto"
import { supabase, isSupabaseConfigured } from "./supabase"
import { resolveIndustryName } from "./industries"
import { getSignedResourceUrl } from "./partner-service"
import { notifyAllAdmins } from "./admin-notifications"

const BROCHURE_CATEGORIES = ["Brochure", "Product Brochures"]

export interface BrochureLeadInput {
  fullName: string
  businessName: string
  email: string
  phone: string
  businessType: string
}

export interface Brochure {
  id: string
  title: string
  description: string
}

export async function getActiveBrochureResource(): Promise<Record<string, unknown> | null> {
  if (!isSupabaseConfigured()) return null

  const { data, error } = await supabase
    .from("partner_resources")
    .select("*")
    .eq("active", true)
    .in("category", BROCHURE_CATEGORIES)
    .order("created_at", { ascending: false })
    .maybeSingle()

  if (error || !data) {
    if (error) console.error("[getActiveBrochure]", error.message)
    return null
  }

  return data as Record<string, unknown>
}

export async function getActiveBrochure(): Promise<Brochure | null> {
  const resource = await getActiveBrochureResource()
  if (!resource) return null

  return {
    id: resource.id as string,
    title: (resource.title as string) || "MartPoint Brochure",
    description: (resource.description as string) || "Download the MartPoint product brochure.",
  }
}

export async function getBrochureSignedUrl(): Promise<string | null> {
  const resource = await getActiveBrochureResource()
  if (!resource) return null
  return getSignedResourceUrl(resource)
}

export async function createBrochureLead(input: BrochureLeadInput): Promise<boolean> {
  if (!isSupabaseConfigured()) return true

  const now = new Date().toISOString()
  const leadId = crypto.randomUUID()
  const { error } = await supabase.from("leads").insert({
    id: leadId,
    full_name: input.fullName,
    business_name: input.businessName,
    email: input.email,
    phone: input.phone,
    business_type: input.businessType,
    industry: resolveIndustryName(input.businessType),
    product_interest: "not-sure",
    branches: "N/A",
    staff_size: "N/A",
    source: "brochure",
    status: "New",
    submitted_at: now,
    updated_at: now,
  })

  if (error) {
    console.error("[createBrochureLead]", error)
    return false
  }

  await notifyAllAdmins({
    type: "LEAD_RECEIVED",
    title: "New brochure request",
    message: `${input.businessName} · ${input.fullName} · ${input.email}`,
    deep_link: `/admin/leads?lead=${encodeURIComponent(leadId)}`,
    source_type: "lead",
    source_id: leadId,
    email: {
      route: "lead_submission",
      subject: `New brochure request — ${input.businessName}`,
      text: [
        "A visitor requested the MartPoint brochure.",
        `Name: ${input.fullName}`,
        `Business: ${input.businessName}`,
        `Email: ${input.email}`,
        `Phone: ${input.phone}`,
        `Business type: ${input.businessType}`,
      ].join("\n"),
    },
  })

  return true
}
