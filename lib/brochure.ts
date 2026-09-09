import crypto from "crypto"
import { supabase, isSupabaseConfigured } from "./supabase"
import { getSignedResourceUrl } from "./partner-service"

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
  const { error } = await supabase.from("leads").insert({
    id: crypto.randomUUID(),
    full_name: input.fullName,
    business_name: input.businessName,
    email: input.email,
    phone: input.phone,
    business_type: input.businessType,
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

  return true
}
