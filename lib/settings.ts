import { cache } from "react"
import { supabase, isSupabaseConfigured } from "./supabase"

export const readSettings = cache(async function readSettings(): Promise<Record<string, unknown> | null> {
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
})
