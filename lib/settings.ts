import { cache } from "react"
import { unstable_cache } from "next/cache"
import { supabase, isSupabaseConfigured } from "./supabase"
import { getIntegrationDefaults, type IntegrationSettings } from "./integrations"

const fetchSettings = unstable_cache(
  async function fetchSettings(): Promise<Record<string, unknown> | null> {
    if (!isSupabaseConfigured()) {
      return null
    }

    try {
      const { data, error } = await supabase
        .from("settings")
        .select("data")
        .eq("id", 1)
        .single()

      if (error || !data) {
        return null
      }

      return (data.data as Record<string, unknown>) || null
    } catch {
      return null
    }
  },
  ["site-settings"],
  { revalidate: 3600, tags: ["settings"] }
)

export const readSettings = cache(async function readSettings(): Promise<Record<string, unknown> | null> {
  return fetchSettings()
})

export interface PublicSiteSettings {
  companyName: string
  contactEmail: string
  whatsappNumber: string
  phone: string
  accountNumber: string
  logo: string
  googleReviewUrl: string
}

/**
 * Footer/social data for outbound emails, read from live admin settings
 * (`settings.data.social`, `.general`, `.footer`). Falls back to known
 * MartPoint defaults when a field is not configured.
 */
export interface EmailFooterSettings {
  social: Record<string, string>
  contactEmail: string
  phone: string
  whatsappNumber: string
  companyName: string
  website: string
}

export async function getEmailFooterSettings(): Promise<EmailFooterSettings> {
  const defaults: EmailFooterSettings = {
    social: {
      facebook: "https://facebook.com/usemartpoint",
      instagram: "https://instagram.com/usemartpoint",
      twitter: "https://x.com/usemartpoint",
      linkedin: "https://www.linkedin.com/company/usemartpoint",
      youtube: "https://www.youtube.com/@usemartpoint",
      tiktok: "https://www.tiktok.com/@usemartpoint",
    },
    contactEmail: "sales@martpoint.com.ng",
    phone: "+234 701 042 6993",
    whatsappNumber: "+2348037978230",
    companyName: "MartPoint Solutions",
    website: "https://martpoint.com.ng",
  }

  try {
    const settings = await readSettings()
    if (!settings) return defaults
    const social = (settings.social as Record<string, string> | undefined) || {}
    const general = (settings.general as Record<string, unknown> | undefined) || {}
    // Only trust configured URLs that are real links (skip "", "#", "n/a").
    const usable = Object.fromEntries(
      Object.entries(social).filter(([, v]) => typeof v === "string" && /^https?:\/\//i.test(v.trim())),
    )
    return {
      social: { ...defaults.social, ...usable },
      contactEmail: String(general.contactEmail || defaults.contactEmail),
      phone: String(general.phone || defaults.phone),
      whatsappNumber: String(general.whatsappNumber || defaults.whatsappNumber),
      companyName: String(general.companyName || defaults.companyName),
      website: defaults.website,
    }
  } catch (err) {
    console.error("[settings] getEmailFooterSettings", err)
    return defaults
  }
}

export async function getPublicSiteSettings(): Promise<PublicSiteSettings> {
  const defaults: PublicSiteSettings = {
    companyName: "MartPoint",
    contactEmail: "hello@martpoint.com.ng",
    whatsappNumber: "+2348037978230",
    phone: "+2348037978230",
    accountNumber: "",
    logo: "/logo.webp",
    googleReviewUrl: "https://g.page/r/Cb5Gukc0lQW8EBM/review",
  }

  try {
    const settings = await readSettings()
    if (!settings) return defaults
    const general = (settings.general as Record<string, unknown> | undefined) || {}
    const header = (settings.header as Record<string, unknown> | undefined) || {}
    return {
      companyName: String(general.companyName || defaults.companyName),
      contactEmail: String(general.contactEmail || defaults.contactEmail),
      whatsappNumber: String(general.whatsappNumber || defaults.whatsappNumber),
      phone: String(general.phone || defaults.phone),
      accountNumber: String(general.accountNumber || ""),
      logo: String(header.logo || defaults.logo),
      googleReviewUrl: String(general.googleReviewUrl ?? defaults.googleReviewUrl),
    }
  } catch (err) {
    console.error("[settings] getPublicSiteSettings", err)
    return defaults
  }
}

export async function getSettings(): Promise<Record<string, unknown> & IntegrationSettings> {
  const stored = (await readSettings()) || {}
  const defaults = getIntegrationDefaults()

  return {
    ...stored,
    livekit: { ...defaults.livekit, ...((stored.livekit || {}) as Partial<IntegrationSettings["livekit"]>) },
    whatsapp: { ...defaults.whatsapp, ...((stored.whatsapp || {}) as Partial<IntegrationSettings["whatsapp"]>) },
    adLeads: { ...defaults.adLeads, ...((stored.adLeads || {}) as Partial<IntegrationSettings["adLeads"]>) },
  } as Record<string, unknown> & IntegrationSettings
}
