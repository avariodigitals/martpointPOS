import { createHash } from "crypto"
import { supabase } from "./supabase"
import { htmlToText } from "./email-html"
import { normalizeCommunicationPhone } from "./communications-policy"

export type CommunicationLead = {
  id: string; full_name: string; business_name: string; email: string; phone: string;
  status: string; product_interest: string; business_type: string; notes: string | null;
  reminders_paused: boolean; submitted_at: string; message: string | null
}
export type ConversationEntry = { at: string; channel: string; direction: string; text: string; subject?: string; providerId?: string }

/** Pagination is deliberate: AI must not silently see only the newest page. */
async function allPages<T>(page: (offset: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const rows: T[] = []
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await page(offset)
    if (error) throw new Error("Could not load the complete lead conversation")
    rows.push(...(data || []))
    if (!data || data.length < 500) return rows
    if (rows.length > 10000) throw new Error("Conversation requires staff review because it is too large for automatic preparation")
  }
}

export async function loadCommunicationContext(leadId: string) {
  const { data, error } = await supabase.from("leads").select("id,full_name,business_name,email,phone,status,product_interest,business_type,notes,reminders_paused,submitted_at,message").eq("id", leadId).maybeSingle()
  if (error || !data) throw new Error("Lead not found or its conversation could not be loaded")
  const lead = data as CommunicationLead
  const phone = normalizeCommunicationPhone(lead.phone || "")
  const variants = [...new Set([phone, phone.replace(/^\+/, ""), phone.startsWith("+234") ? `0${phone.slice(4)}` : phone, lead.phone].filter(Boolean))]
  const matching = phone ? await supabase.from("leads").select("id").in("phone", variants).limit(2) : { data: [], error: null }
  if (matching.error) throw new Error("Could not verify the conversation contact")
  const uniquePhone = matching.data?.length === 1 && matching.data[0].id === leadId
  const linked = await supabase.from("azera_conversations").select("id,channel").eq("lead_id", leadId)
  if (linked.error) throw new Error("Could not load linked lead conversations. Apply migration 161.")
  const byPhone = uniquePhone ? await supabase.from("azera_conversations").select("id,channel").in("customer_phone", variants) : { data: [], error: null }
  if (byPhone.error) throw new Error("Could not load the lead's chat history")
  const conversationRows = [...new Map([...(linked.data || []), ...(byPhone.data || [])].map((row) => [row.id, row])).values()]
  const conversationIds = conversationRows.map((row) => row.id)
  const channelByConversation = new Map(conversationRows.map((row) => [row.id, row.channel === "sms" || row.channel === "whatsapp" ? row.channel : "chat"]))
  const emails = await allPages((offset) => supabase.from("lead_emails").select("created_at,direction,subject,body_text,body_html,provider_message_id").eq("lead_id", leadId).in("status", ["sent", "accepted", "received", "delivered"]).order("created_at").order("id").range(offset, offset + 499))
  const sms = await allPages((offset) => supabase.from("communication_messages").select("created_at,body,status").eq("lead_id", leadId).eq("channel", "sms").in("status", ["accepted", "delivered"]).order("created_at").order("id").range(offset, offset + 499))
  const chats = conversationIds.length ? await allPages((offset) => supabase.from("azera_messages").select("conversation_id,created_at,direction,message,author_type").in("conversation_id", conversationIds).neq("author_type", "system").order("created_at").order("id").range(offset, offset + 499)) : []
  const history: ConversationEntry[] = [
    ...emails.map((row) => ({ at: row.created_at, channel: "email", direction: row.direction, subject: row.subject || "", text: row.body_text || htmlToText(row.body_html || ""), providerId: row.provider_message_id || undefined })),
    ...sms.map((row) => ({ at: row.created_at, channel: "sms", direction: "outbound", text: row.body })),
    ...chats.map((row) => ({ at: row.created_at, channel: channelByConversation.get(row.conversation_id) || "chat", direction: row.direction, text: row.message })),
  ].sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
  const lastInbound = history.filter((row) => row.direction === "inbound").at(-1)?.at || null
  const lastOutbound = history.filter((row) => row.direction === "outbound").at(-1)?.at || null
  const serialized = JSON.stringify({ profile: lead, conversation: history })
  if (serialized.length > 100000) throw new Error("This conversation is too long for automatic AI preparation. Review it with a teammate; no messages have been omitted or sent.")
  return { lead, history, lastInbound, lastOutbound, serialized, revision: createHash("sha256").update(serialized).digest("hex") }
}
