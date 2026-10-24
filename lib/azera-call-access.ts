import { getSession, hasPermission } from "@/lib/admin-auth"
import { getCustomerSupportSession } from "@/lib/customer-support-auth"
import { supabase } from "@/lib/supabase"
import { isConversationIdentityMatch } from "@/lib/azera-identity"
import { tokenFromRequest, verifyConversationToken } from "@/lib/azera-public-auth"
import { createHmac } from "node:crypto"

export type CallActor = { type: "agent" | "customer"; id: string | null }

// Public tokens take precedence over admin cookies: staff testing the website
// must still act as the visitor, not accidentally as both ends of the call.
export async function getCallAccess(request: Request, id: string) {
  const { data: call, error } = await supabase.from("azera_calls").select("*").eq("id", id).maybeSingle()
  if (error || !call) return null
  const token = tokenFromRequest(request)
  if (token) {
    const claims = verifyConversationToken(token)
    if (!claims || claims.businessId !== call.business_id || claims.conversationId !== call.conversation_id) return null
    const { data: conversation } = await supabase.from("azera_conversations")
      .select("id,business_id,external_id").eq("id", call.conversation_id).maybeSingle()
    if (!conversation || !isConversationIdentityMatch(claims, conversation)) return null
    return { call, actor: { type: "customer", id: null } satisfies CallActor }
  }
  const admin = await getSession()
  if (admin && hasPermission(admin.role, "azera")) {
    return { call, actor: { type: "agent", id: admin.userId } satisfies CallActor }
  }
  const customer = await getCustomerSupportSession()
  if (customer?.businessId === call.business_id) {
    return { call, actor: { type: "customer", id: null } satisfies CallActor }
  }
  return null
}

export function callIceServers(): RTCIceServer[] {
  const servers: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }]
  const urls = (process.env.AZERA_TURN_URLS || "").split(",").map((url) => url.trim())
    .filter((url) => /^turns?:[^\s]+$/.test(url))
  if (!urls.length) return servers
  const secret = process.env.AZERA_TURN_SECRET
  const username = secret ? `${Math.floor(Date.now() / 1000) + 3600}:azera` : process.env.AZERA_TURN_USERNAME
  const credential = secret && username ? createHmac("sha1", secret).update(username).digest("base64") : process.env.AZERA_TURN_CREDENTIAL
  if (username && credential) servers.push({ urls, username, credential })
  return servers
}
