import { cookies } from "next/headers"
import { signSession, verifySession } from "./session-secret"
import { supabase, isSupabaseConfigured } from "./supabase"

export interface CustomerSupportSession {
  businessId: string
  email: string
  businessName: string
  contactName: string
}

const COOKIE_NAME = "customer-support-session"

function isCustomerSupportSession(value: unknown): value is CustomerSupportSession {
  if (!value || typeof value !== "object") return false
  const v = value as Record<string, unknown>
  return (
    typeof v.businessId === "string" &&
    typeof v.email === "string" &&
    typeof v.businessName === "string" &&
    typeof v.contactName === "string"
  )
}

export async function createCustomerSupportSession(business: {
  id: string
  business_name: string
  primary_email: string
  primary_contact_name: string
}) {
  const cookieStore = await cookies()
  const payload: CustomerSupportSession = {
    businessId: business.id,
    email: business.primary_email,
    businessName: business.business_name,
    contactName: business.primary_contact_name,
  }
  const token = signSession(payload)
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  })
}

export async function getCustomerSupportSession(): Promise<CustomerSupportSession | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)
  if (!token?.value) return null
  return verifySession(token.value, isCustomerSupportSession)
}

export async function destroyCustomerSupportSession() {
  const cookieStore = await cookies()
  cookieStore.delete(COOKIE_NAME)
}

/* ─── Magic link tokens ─── */

const MAGIC_TTL_MS = 15 * 60 * 1000

interface MagicPayload {
  purpose: "support-magic"
  businessId: string
  email: string
  businessName: string
  contactName: string
  exp: number
}

function isMagicPayload(value: unknown): value is MagicPayload {
  if (!value || typeof value !== "object") return false
  const v = value as Record<string, unknown>
  return (
    v.purpose === "support-magic" &&
    typeof v.businessId === "string" &&
    typeof v.email === "string" &&
    typeof v.businessName === "string" &&
    typeof v.contactName === "string" &&
    typeof v.exp === "number"
  )
}

export function createSupportMagicToken(business: {
  id: string
  business_name: string
  primary_email: string
  primary_contact_name: string
}): string {
  return signSession<MagicPayload>({
    purpose: "support-magic",
    businessId: business.id,
    email: business.primary_email,
    businessName: business.business_name,
    contactName: business.primary_contact_name,
    exp: Date.now() + MAGIC_TTL_MS,
  })
}

export function verifySupportMagicToken(token: string): MagicPayload | null {
  const payload = verifySession(token, isMagicPayload)
  if (!payload || payload.exp < Date.now()) return null
  return payload
}

export async function authenticateCustomerByEmail(email: string) {
  if (!isSupabaseConfigured()) return null
  const { data, error } = await supabase
    .from("businesses")
    .select("id, business_name, primary_email, primary_contact_name, status")
    .ilike("primary_email", email.trim())
    .maybeSingle()
  if (error || !data) return null
  if (["SUSPENDED", "INACTIVE", "CHURNED"].includes(data.status as string)) return null
  return data
}
