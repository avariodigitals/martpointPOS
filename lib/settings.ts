import { cache } from "react"
import { unstable_cache } from "next/cache"
import { supabase, isSupabaseConfigured } from "./supabase"

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
