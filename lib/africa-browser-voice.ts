import { getSettings } from "@/lib/settings"
import { supabase } from "@/lib/supabase"
import { normalizeOutboundPhone } from "@/lib/azera-outbound"

export async function africaBrowserConfig(businessId?: string) {
  const settings = await getSettings()
  const sip = (settings.sip || {}) as Record<string, unknown>
  let businessPhone = ""
  if (businessId) {
    const { data } = await supabase
      .from("azera_settings")
      .select("africas_talking_phone_number")
      .eq("business_id", businessId)
      .maybeSingle()
    businessPhone = String(data?.africas_talking_phone_number || "")
  }
  return {
    apiKey: String(sip.api_key || process.env.AFRICASTALKING_API_KEY || ""),
    username: String(sip.username || process.env.AFRICASTALKING_USERNAME || ""),
    phone:
      normalizeOutboundPhone(
        businessPhone ||
          String(sip.from_number || process.env.AFRICASTALKING_FROM || "")
      ) || "",
  }
}
export function africaBrowserReady(config: {
  apiKey: string
  username: string
  phone: string
}) {
  return Boolean(
    config.apiKey &&
      config.username &&
      config.username !== "sandbox" &&
      config.phone
  )
}

/** Only a short-lived browser capability leaves the server, never the API key. */
export async function africaCapability(
  config: Awaited<ReturnType<typeof africaBrowserConfig>>,
  clientName: string
) {
  const response = await fetch(
    "https://webrtc.africastalking.com/capability-token/request",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        apiKey: config.apiKey,
      },
      body: JSON.stringify({
        username: config.username,
        phoneNumber: config.phone,
        clientName,
        incoming: false,
        outgoing: true,
        expire: "3600s",
      }),
      signal: AbortSignal.timeout(15_000),
    }
  )
  const data = await response.json().catch(() => null)
  if (!response.ok || typeof data?.token !== "string" || !data.token)
    throw new Error(
      "Africa’s Talking could not authorise browser calling. Check your Voice/WebRTC activation, virtual number and account balance."
    )
  return data.token as string
}
