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
}

export async function getPublicSiteSettings(): Promise<PublicSiteSettings> {
  const defaults: PublicSiteSettings = {
    companyName: "MartPoint",
    contactEmail: "hello@martpoint.com.ng",
    whatsappNumber: "+2348036028069",
    phone: "+2348037978230",
    accountNumber: "",
    logo: "/logo.webp",
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
  } as Record<string, unknown> & IntegrationSettings
}
