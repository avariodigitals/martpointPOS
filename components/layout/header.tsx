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

  return <HeaderClient logo={header.logo || "/logo.webp"} />
}
