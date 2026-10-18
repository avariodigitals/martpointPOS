import { createHmac, randomBytes, timingSafeEqual } from "node:crypto"

type PublicConversationClaims = {
  conversationId: string
  businessId: string
  externalId: string
  expiresAt: number
  nonce: string
}

const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30

function secret(): string {
  const value = process.env.AZERA_PUBLIC_CHAT_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!value) throw new Error("AZERA_PUBLIC_CHAT_SECRET is not configured")
  return value
}

function encode(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url")
}

function decode(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8")
}

function signature(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url")
}

export function issueConversationToken(input: Omit<PublicConversationClaims, "expiresAt" | "nonce">): string {
  const claims: PublicConversationClaims = {
    ...input,
    expiresAt: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
    nonce: randomBytes(18).toString("base64url"),
  }
  const payload = encode(JSON.stringify(claims))
  return `${payload}.${signature(payload)}`
}

export function verifyConversationToken(token: string | null | undefined): PublicConversationClaims | null {
  if (!token) return null
  const parts = token.split(".")
  if (parts.length !== 2) return null
  try {
    const expected = Buffer.from(signature(parts[0]))
    const actual = Buffer.from(parts[1])
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null
    const claims = JSON.parse(decode(parts[0])) as PublicConversationClaims
    if (!claims.conversationId || !claims.businessId || !claims.externalId || !claims.nonce) return null
    if (!Number.isFinite(claims.expiresAt) || claims.expiresAt < Math.floor(Date.now() / 1000)) return null
    return claims
  } catch {
    return null
  }
}

export function tokenFromRequest(request: Request, bodyToken?: unknown): string | null {
  return request.headers.get("x-azera-chat-token") || (typeof bodyToken === "string" ? bodyToken : null)
}

