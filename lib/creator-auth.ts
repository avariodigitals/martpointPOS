/* ───────────────────────────  Creator portal auth  ───────────────────────────
 * Cookie session for the Creator Portal — mirrors lib/partner-auth.ts.
 * Creators authenticate with email + password against the `creators` table;
 * activation happens through a one-time set-password link issued on approval.
 * Creator sessions are completely separate from admin sessions — creators can
 * NEVER reach /admin (different cookie, different guard).
 */

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { NextResponse } from "next/server"
import crypto from "crypto"
import { supabase, isSupabaseConfigured } from "./supabase"
import { hashPassword, verifyPassword, hashToken } from "./crypto"
import { signSession, verifySession } from "./session-secret"
import { getCreatorById, getCreatorByEmail, type CreatorRecord } from "./creators"

export interface CreatorSession {
  creatorId: string
  email: string
  name: string
  sessionVersion: number
}

const CREATOR_COOKIE_NAME = "creator-session"
const SESSION_VERSION = 1

function isCreatorSession(value: unknown): value is CreatorSession {
  if (!value || typeof value !== "object") return false
  const v = value as Record<string, unknown>
  return (
    typeof v.creatorId === "string" &&
    typeof v.email === "string" &&
    typeof v.name === "string" &&
    typeof v.sessionVersion === "number"
  )
}

export async function createCreatorSession(creator: CreatorRecord): Promise<void> {
  const cookieStore = await cookies()
  const payload: CreatorSession = {
    creatorId: creator.id,
    email: creator.email,
    name: creator.fullName,
    sessionVersion: SESSION_VERSION,
  }
  const token = signSession(payload)
  cookieStore.set(CREATOR_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  })
}

export async function getCreatorSession(): Promise<CreatorSession | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(CREATOR_COOKIE_NAME)
  if (!token?.value) return null
  return verifySession(token.value, isCreatorSession)
}

export async function destroyCreatorSession(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(CREATOR_COOKIE_NAME)
}

async function validateCreatorSession(session: CreatorSession): Promise<CreatorRecord | null> {
  if (session.sessionVersion !== SESSION_VERSION) return null
  const creator = await getCreatorById(session.creatorId)
  if (!creator) return null
  if (creator.email.toLowerCase() !== session.email.toLowerCase()) return null
  if (creator.status !== "ACTIVE") return null
  return creator
}

/** Server-component guard — redirects to /creator/login when unauthenticated. */
export async function requireCreatorSession(): Promise<{ session: CreatorSession; creator: CreatorRecord }> {
  const session = await getCreatorSession()
  if (!session) redirect("/creator/login")
  const creator = await validateCreatorSession(session)
  if (!creator) {
    await destroyCreatorSession()
    redirect("/creator/login")
  }
  return { session, creator }
}

/** Route-handler guard — returns a 401/403 response or the hydrated creator. */
export async function authorizeCreator(): Promise<
  { session: CreatorSession; creator: CreatorRecord; denied: null } | { session: null; creator: null; denied: Response }
> {
  const session = await getCreatorSession()
  if (!session) {
    return { session: null, creator: null, denied: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }
  const creator = await validateCreatorSession(session)
  if (!creator) {
    return {
      session: null,
      creator: null,
      denied: NextResponse.json({ error: "Account unavailable" }, { status: 403 }),
    }
  }
  return { session, creator, denied: null }
}

/* ───────────────────────────  Authentication  ─────────────────────────── */

export async function authenticateCreator(email: string, password: string): Promise<CreatorRecord | null> {
  if (!isSupabaseConfigured()) return null
  const creator = await getCreatorByEmail(email)
  if (!creator) return null
  if (creator.status !== "ACTIVE") return null
  if (!creator.passwordHash) return null
  if (!verifyPassword(password, creator.passwordHash)) return null

  await supabase
    .from("creators")
    .update({ last_login_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", creator.id)

  return creator
}

/* ───────────────────────────  Auth tokens (set / reset password)  ─────────────────────────── */

const TOKEN_TTL_MS = 72 * 60 * 60 * 1000 // 72 hours

export async function createCreatorAuthToken(
  creatorId: string,
  type: "SET_PASSWORD" | "RESET_PASSWORD",
  createdBy?: string | null
): Promise<{ ok: boolean; token?: string }> {
  if (!isSupabaseConfigured()) return { ok: false }
  const token = crypto.randomBytes(32).toString("hex")
  const { error } = await supabase.from("creator_auth_tokens").insert({
    creator_id: creatorId,
    type,
    token_hash: hashToken(token),
    expires_at: new Date(Date.now() + TOKEN_TTL_MS).toISOString(),
    created_by: createdBy ?? null,
  })
  if (error) {
    console.error("[creator-auth] token insert failed:", error.message)
    return { ok: false }
  }
  return { ok: true, token }
}

/** Peek at a token without consuming it — used by the set/reset pages to show
 *  the creator's name and validate the link before rendering the form. */
export async function peekCreatorAuthToken(
  token: string,
  type: "SET_PASSWORD" | "RESET_PASSWORD"
): Promise<{ valid: boolean; creator?: CreatorRecord }> {
  if (!isSupabaseConfigured()) return { valid: false }
  const { data: row } = await supabase
    .from("creator_auth_tokens")
    .select("creator_id, used_at, expires_at")
    .eq("token_hash", hashToken(token))
    .eq("type", type)
    .maybeSingle()
  if (!row || row.used_at) return { valid: false }
  if (new Date(row.expires_at as string).getTime() < Date.now()) return { valid: false }
  const creator = await getCreatorById(row.creator_id as string)
  return { valid: !!creator, creator: creator ?? undefined }
}

export async function consumeCreatorAuthToken(
  token: string,
  type: "SET_PASSWORD" | "RESET_PASSWORD",
  password: string
): Promise<{ ok: boolean; creator?: CreatorRecord; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Service unavailable" }
  const tokenHash = hashToken(token)
  const { data: row, error } = await supabase
    .from("creator_auth_tokens")
    .select("*")
    .eq("token_hash", tokenHash)
    .eq("type", type)
    .maybeSingle()

  if (error || !row) return { ok: false, error: "Invalid or expired link" }
  if (row.used_at) return { ok: false, error: "This link has already been used" }
  if (new Date(row.expires_at as string).getTime() < Date.now()) {
    return { ok: false, error: "This link has expired" }
  }

  const creatorId = row.creator_id as string
  const { error: updateErr } = await supabase
    .from("creators")
    .update({
      password_hash: hashPassword(password),
      status: "ACTIVE",
      email_verified_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", creatorId)
  if (updateErr) return { ok: false, error: "Failed to set password" }

  await supabase
    .from("creator_auth_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("id", row.id as string)

  const creator = await getCreatorById(creatorId)
  return { ok: true, creator: creator ?? undefined }
}
