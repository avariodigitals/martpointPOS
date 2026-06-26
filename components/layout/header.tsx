import { HeaderClient } from "./header-client"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"

async function readSettings(): Promise<Record<string, unknown> | null> {
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
}

export async function Header() {
  const settings = await readSettings()
  const header = (settings?.header as Record<string, string>) || {}

  return (
    <HeaderClient
      logo={header.logo || "/logo.webp"}
      ctaText={header.ctaText || "Book a Call"}
      ctaLink={header.ctaLink || "https://wa.me/+2348036028069?text=Hi%2C%20I%20came%20across%20your%20website%20and%20I%27m%20interested%20in%20learning%20more%20about%20MartPoint%20Retail.%20Can%20we%20talk%3F"}
      secondaryCtaText={header.secondaryCtaText || "See Plans"}
      secondaryCtaLink={header.secondaryCtaLink || "/pricing"}
    />
  )
}
