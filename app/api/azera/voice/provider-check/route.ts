import { NextResponse } from "next/server"
import { getSession, hasPermission } from "@/lib/admin-auth"
import type { SessionPayload, UserRole } from "@/lib/admin-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { getAiVoiceProvider } from "@/lib/ai-voice"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

async function requireSession(): Promise<SessionPayload | null> {
  const session = await getSession()
  return session && hasPermission(session.role as UserRole, "settings") ? session : null
}

async function resolveBusinessId(value: string | null): Promise<string | null> {
  if (value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) return value
  const { data } = await supabase.from("businesses").select("id").order("created_at", { ascending: true }).limit(1).maybeSingle()
  return (data?.id as string | undefined) || null
}

export async function GET(request: Request) {
  const session = await requireSession()
  if (!session) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 })
  if (!isSupabaseConfigured()) return NextResponse.json({ success: false, error: "Supabase not configured" }, { status: 500 })

  const url = new URL(request.url)
  const businessId = await resolveBusinessId(url.searchParams.get("business_id"))
  if (!businessId) return NextResponse.json({ success: false, error: "No business configured" }, { status: 400 })
  const { data: settings } = await supabase.from("azera_settings").select("ai_voice_provider").eq("business_id", businessId).maybeSingle()
  const providerId = url.searchParams.get("provider") || String(settings?.ai_voice_provider || "openai")
  const provider = await getAiVoiceProvider(providerId)
  if (!provider) return NextResponse.json({ success: false, provider: providerId, working: false, error: `${providerId} is not configured` }, { status: 400 })

  try {
    const response = await fetch(`${provider.baseUrl}/models`, {
      headers: { Authorization: `Bearer ${provider.apiKey}` },
      signal: AbortSignal.timeout(10000),
    })
    if (!response.ok) {
      return NextResponse.json({ success: false, provider: provider.id, working: false, error: `Provider returned HTTP ${response.status}` }, { status: 502 })
    }
    return NextResponse.json({ success: true, provider: provider.id, label: provider.label, working: true, model: provider.chatModel, message: `${provider.label} is reachable and the API key was accepted.` })
  } catch (error) {
    return NextResponse.json({ success: false, provider: provider.id, working: false, error: error instanceof Error ? error.message : "Provider check failed" }, { status: 502 })
  }
}
