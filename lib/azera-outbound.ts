import { LiveKitAPI } from "livekit-server-sdk"
import type { LiveKitSettings } from "@/lib/integrations"
import { supabase } from "@/lib/supabase"

export function outboundReady(settings: LiveKitSettings) {
  return [settings.serverUrl, settings.publicUrl, settings.apiKey, settings.apiSecret,
    settings.sipHostname, settings.sipUsername, settings.sipPassword, settings.sipNumber].every((value) => Boolean(value?.trim()))
}

export function normalizeOutboundPhone(raw: string): string | null {
  if (!/^[+\d\s().-]+$/.test(raw)) return null
  let number = raw.replace(/[\s().-]/g, "")
  if (/^0\d{10}$/.test(number)) number = `+234${number.slice(1)}`
  else if (number.startsWith("00")) number = `+${number.slice(2)}`
  else if (/^[1-9]\d{7,14}$/.test(number)) number = `+${number}`
  return /^\+[1-9]\d{7,14}$/.test(number) ? number : null
}

export function voiceApi(settings: LiveKitSettings) {
  return new LiveKitAPI({ host: settings.serverUrl, apiKey: settings.apiKey, secret: settings.apiSecret, requestTimeout: 20 })
}

export interface OutboundCallRecord {
  id: string; status: string; answered_at: string | null
}

export async function deleteVoiceRoom(api: LiveKitAPI, room: string) {
  try { await api.room.deleteRoom(room) }
  catch (error) { if (!(error && typeof error === "object" && "code" in error && error.code === "not_found")) throw error }
}

export async function finishOutbound(call: OutboundCallRecord, status: "active" | "ended" | "failed" | "missed", actorId: string) {
  const now = new Date().toISOString()
  const { data, error } = await supabase.from("azera_calls").update({
    status, updated_at: now,
    ...(status === "active" ? { answered_at: now } : { ended_at: now,
      duration_seconds: call.answered_at ? Math.max(0, Math.floor((Date.now() - Date.parse(call.answered_at)) / 1000)) : 0 }),
  }).eq("id", call.id).eq("status", call.status).select("status").maybeSingle()
  if (error) throw new Error("Could not update call history")
  if (data) await supabase.from("azera_call_events").insert({ call_id: call.id,
    event_type: status === "active" ? "answered" : status, actor_type: "agent", actor_id: actorId,
    metadata: { status, provider: "livekit" }, created_at: now })
  return data?.status || call.status
}
