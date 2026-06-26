import { NextResponse } from "next/server"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"

async function readSettings(): Promise<Record<string, unknown>> {
  if (!isSupabaseConfigured()) {
    return {}
  }

  try {
    const { data, error } = await supabase
      .from("settings")
      .select("data")
      .eq("id", 1)
      .single()

    if (error || !data) {
      return {}
    }

    return (data.data as Record<string, unknown>) || {}
  } catch {
    return {}
  }
}

export async function GET() {
  const settings = await readSettings()
  // Only expose public-safe settings
  return NextResponse.json({
    popup: (settings.popup as Record<string, unknown>) || null,
    general: {
      companyName: (settings.general as Record<string, string>)?.companyName || "MartPoint",
      whatsappNumber: (settings.general as Record<string, string>)?.whatsappNumber || "",
      contactEmail: (settings.general as Record<string, string>)?.contactEmail || "",
    },
  })
}
