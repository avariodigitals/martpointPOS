import { supabase } from "@/lib/supabase"
import { getSettings } from "@/lib/settings"

export type DeliveryResult = {
  status: "accepted" | "failed" | "unknown" | "not_required"
  providerId?: string
  error?: string
}
export type ChannelConversation = {
  id: string
  business_id: string
  channel: string
  external_id: string
}
export function socialChannel(channel: string) {
  return ["whatsapp", "messenger", "instagram"].includes(channel)
}

export async function dispatchChannelText(
  conversation: ChannelConversation,
  text: string
): Promise<DeliveryResult> {
  if (conversation.channel === "website") return { status: "not_required" }
  if (!socialChannel(conversation.channel))
    return {
      status: "failed",
      error: "This channel does not have a configured sender.",
    }
  const max = conversation.channel === "whatsapp" ? 4096 : 1000
  if (text.length > max)
    return {
      status: "failed",
      error: `This channel accepts up to ${max} characters per reply.`,
    }
  const { data: inbound, error: inboundError } = await supabase
    .from("azera_messages")
    .select("created_at")
    .eq("conversation_id", conversation.id)
    .eq("direction", "inbound")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (
    inboundError ||
    !inbound ||
    Date.now() - Date.parse(inbound.created_at) >= 24 * 60 * 60 * 1000
  ) {
    return {
      status: "failed",
      error:
        "The standard 24-hour reply window is closed or cannot be verified. Ask the customer to message again, or use an approved provider template.",
    }
  }
  const { data: row, error: configError } = await supabase
    .from("azera_settings")
    .select(
      "messenger_page_id,messenger_page_access_token,instagram_account_id,instagram_access_token,whatsapp_phone_number_id,whatsapp_access_token,whatsapp_phone_number"
    )
    .eq("business_id", conversation.business_id)
    .maybeSingle()
  if (configError)
    return {
      status: "failed",
      error:
        "Apply the contact-centre migration before sending social replies.",
    }
  const version = process.env.META_GRAPH_VERSION || "v23.0"
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  let url: string, payload: Record<string, unknown>
  if (conversation.channel === "whatsapp") {
    const phoneId =
      row?.whatsapp_phone_number_id || process.env.WHATSAPP_PHONE_NUMBER_ID
    const token =
      row?.whatsapp_access_token || process.env.WHATSAPP_ACCESS_TOKEN
    const to = conversation.external_id
      .replace(/^whatsapp:/, "")
      .replace(/^\+/, "")
    if (!/^\d{7,15}$/.test(to))
      return {
        status: "failed",
        error: "This WhatsApp contact has an invalid recipient ID.",
      }
    payload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "text",
      text: { body: text },
    }
    if (phoneId && token) {
      if (!/^\d+$/.test(String(phoneId)))
        return {
          status: "failed",
          error: "Check the configured WhatsApp phone number ID.",
        }
      url = `https://graph.facebook.com/${version}/${phoneId}/messages`
      headers.Authorization = `Bearer ${token}`
    } else {
      const { whatsapp } = await getSettings()
      if (!whatsapp.apiKey)
        return {
          status: "failed",
          error:
            "Configure WhatsApp Cloud API or the existing 360dialog integration first.",
        }
      const mappedNumber = String(row?.whatsapp_phone_number || "").replace(
        /\D/g,
        ""
      )
      if (
        !mappedNumber ||
        mappedNumber !== String(whatsapp.phoneNumber || "").replace(/\D/g, "")
      )
        return {
          status: "failed",
          error:
            "Match this business’s WhatsApp number to the number configured in the 360dialog integration.",
        }
      const base = new URL(whatsapp.baseUrl)
      if (
        base.protocol !== "https:" ||
        !/(^|\.)360dialog\.(io|com)$/.test(base.hostname)
      )
        return {
          status: "failed",
          error: "Use an HTTPS 360dialog API endpoint.",
        }
      url = `${base.origin}${base.pathname.replace(/\/$/, "")}/messages`
      headers["D360-API-KEY"] = whatsapp.apiKey
    }
  } else {
    const instagram = conversation.channel === "instagram"
    const account = instagram
      ? row?.instagram_account_id
      : row?.messenger_page_id
    const token = instagram
      ? row?.instagram_access_token || process.env.INSTAGRAM_ACCESS_TOKEN
      : row?.messenger_page_access_token ||
        process.env.MESSENGER_PAGE_ACCESS_TOKEN
    const recipient = conversation.external_id.replace(
      /^(messenger|instagram):/,
      ""
    )
    if (
      !account ||
      !token ||
      !/^\d+$/.test(String(account)) ||
      !/^\d+$/.test(recipient)
    )
      return {
        status: "failed",
        error: `Configure the ${instagram ? "Instagram account" : "Messenger page"} ID and messaging access token in Azera Settings.`,
      }
    url = `https://graph.facebook.com/${version}/${account}/messages`
    headers.Authorization = `Bearer ${token}`
    payload = {
      recipient: { id: recipient },
      message: { text },
      ...(instagram ? {} : { messaging_type: "RESPONSE" }),
    }
  }
  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      redirect: "error",
      signal: AbortSignal.timeout(12_000),
    })
    const data = await response.json().catch(() => null)
    if (!response.ok)
      return {
        status: response.status >= 500 ? "unknown" : "failed",
        error: `The messaging provider returned HTTP ${response.status}. Check the account permissions, reply window and connection settings.`,
      }
    const providerId = data?.message_id || data?.messages?.[0]?.id
    if (typeof providerId !== "string" || !providerId)
      return {
        status: "unknown",
        error:
          "The provider response did not include a message ID. Check the provider inbox before retrying.",
      }
    return { status: "accepted", providerId }
  } catch {
    return {
      status: "unknown",
      error:
        "The provider did not confirm the send result. Check its inbox before retrying to avoid a duplicate.",
    }
  }
}
