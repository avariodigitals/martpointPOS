import { timingSafeEqual } from "node:crypto"
import { supabase } from "@/lib/supabase"

export type ChatSource = "public_site" | "retail_app"

function sameSecret(value: string | null): boolean {
  const expected = process.env.AZERA_PHP_BRIDGE_SECRET
  if (!expected || !value) return false
  const a = Buffer.from(expected)
  const b = Buffer.from(value)
  return a.length === b.length && timingSafeEqual(a, b)
}

export function requireRetailBridge(request: Request): string | null {
  const value = request.headers.get("x-martpoint-chat-bridge")
  return sameSecret(value) ? null : "Merchant chat bridge is not authorized"
}

export async function resolveChatBusinessId(
  request: Request,
  source: ChatSource,
  requestedId: unknown,
  identity?: { email?: unknown; phone?: unknown; name?: unknown },
): Promise<{ id?: string; error?: string; status?: number }> {
  if (source === "public_site") {
    // Keep the server authoritative, but accept the public-site variable as a
    // compatibility fallback so a deployment does not render a working widget
    // that then fails every message with “not configured”.
    const configured = (
      process.env.AZERA_PUBLIC_BUSINESS_ID || process.env.NEXT_PUBLIC_AZERA_BUSINESS_ID
    )?.trim()
    if (!configured) return { error: "Azera public support business is not configured", status: 503 }
    return { id: configured }
  }

  const bridgeError = requireRetailBridge(request)
  if (bridgeError) return { error: bridgeError, status: 403 }

  const storeId = Number(requestedId)
  if (!Number.isSafeInteger(storeId) || storeId <= 0) {
    return { error: "A valid merchant store identity is required", status: 400 }
  }

  // Prefer an explicit mapping. This prevents a caller from choosing a UUID
  // and preserves the canonical businesses identity model.
  const { data: mapped, error: mappingError } = await supabase
    .from("azera_business_store_mappings")
    .select("business_id")
    .eq("store_id", storeId)
    .maybeSingle()

  if (!mappingError && mapped?.business_id) return { id: mapped.business_id as string }
  if (mappingError && mappingError.code !== "PGRST205") {
    return { error: "Merchant identity mapping could not be read", status: 503 }
  }

  // Before the mapping table is populated, use only a unique exact match on
  // trusted PHP store contact data. The browser never supplies these values.
  const email = String(identity?.email || "").trim().toLowerCase()
  const phone = String(identity?.phone || "").trim()
  const name = String(identity?.name || "").trim()
  if (!email && !phone) return { error: "This merchant store is not mapped", status: 409 }

  let query = supabase.from("businesses").select("id").limit(2)
  if (email) query = query.eq("primary_email", email)
  else query = query.eq("primary_phone", phone)
  const { data: candidates, error: candidateError } = await query
  if (candidateError) return { error: "Merchant identity mapping could not be verified", status: 503 }
  if ((candidates || []).length === 1) return { id: candidates![0].id as string }

  if (phone && name) {
    const { data: named, error: namedError } = await supabase
      .from("businesses")
      .select("id")
      .eq("primary_phone", phone)
      .eq("business_name", name)
      .limit(2)
    if (!namedError && (named || []).length === 1) return { id: named![0].id as string }
  }

  return { error: "This merchant store is not mapped to a MartPoint business", status: 409 }
}

export function isConversationIdentityMatch(
  claims: { conversationId: string; businessId: string; externalId: string },
  conversation: { id: string; business_id: string; external_id: string },
): boolean {
  return claims.conversationId === conversation.id && claims.businessId === conversation.business_id && claims.externalId === conversation.external_id
}

