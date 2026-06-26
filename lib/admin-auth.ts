import { cookies } from "next/headers"
import crypto from "crypto"
import type { User, UserRole, SessionPayload } from "./admin-types"
import { supabase, isSupabaseConfigured } from "./supabase"
export type { User, UserRole, SessionPayload }

const ADMIN_COOKIE_NAME = "admin-session"

/* ───────────────────────────  PASSWORD UTILS  ─────────────────────────── */

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex")
  const hash = crypto.scryptSync(password, salt, 64).toString("hex")
  return `${salt}:${hash}`
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":")
  if (!salt || !hash) return false
  const derived = crypto.scryptSync(password, salt, 64).toString("hex")
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(derived))
}

/* ───────────────────────────  USER STORE (Supabase)  ─────────────────────────── */

function mapUser(row: Record<string, unknown>): User {
  return {
    id: row.id as string,
    username: row.username as string,
    name: row.name as string,
    passwordHash: row.password_hash as string,
    role: row.role as UserRole,
    createdAt: row.created_at as string,
  }
}

async function readUsers(): Promise<User[]> {
  if (!isSupabaseConfigured()) return []
  const { data, error } = await supabase.from("users").select("*").order("created_at", { ascending: true })
  if (error || !data) return []
  return data.map(mapUser)
}

export async function getUserByUsername(username: string): Promise<User | undefined> {
  if (!isSupabaseConfigured()) return undefined
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .ilike("username", username)
    .single()
  if (error || !data) return undefined
  return mapUser(data)
}

export async function getUserById(id: string): Promise<User | undefined> {
  if (!isSupabaseConfigured()) return undefined
  const { data, error } = await supabase.from("users").select("*").eq("id", id).single()
  if (error || !data) return undefined
  return mapUser(data)
}

export async function getAllUsers(): Promise<User[]> {
  return readUsers()
}

export async function createUser(
  username: string,
  password: string,
  name: string,
  role: UserRole
): Promise<User> {
  const user: User = {
    id: crypto.randomUUID(),
    username: username.toLowerCase().trim(),
    name: name.trim(),
    passwordHash: hashPassword(password),
    role,
    createdAt: new Date().toISOString(),
  }
  if (isSupabaseConfigured()) {
    await supabase.from("users").insert({
      id: user.id,
      username: user.username,
      name: user.name,
      password_hash: user.passwordHash,
      role: user.role,
      created_at: user.createdAt,
    })
  }
  return user
}

export async function updateUser(
  id: string,
  updates: Partial<Omit<User, "id" | "createdAt" | "passwordHash"> & { password?: string }>
): Promise<User | null> {
  if (!isSupabaseConfigured()) return null
  const { data } = await supabase.from("users").select("*").eq("id", id).single()
  if (!data) return null

  const updateData: Record<string, unknown> = {}
  if (updates.username) updateData.username = updates.username
  if (updates.name) updateData.name = updates.name
  if (updates.role) updateData.role = updates.role
  if (updates.password) updateData.password_hash = hashPassword(updates.password)

  const { data: updated } = await supabase.from("users").update(updateData).eq("id", id).select().single()
  if (!updated) return null
  return mapUser(updated)
}

export async function deleteUser(id: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false
  const { error } = await supabase.from("users").delete().eq("id", id)
  return !error
}

/* ───────────────────────────  DEFAULT ADMIN  ─────────────────────────── */

function generateRandomPassword(length = 16): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*"
  let password = ""
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return password
}

export async function ensureDefaultAdmin() {
  const users = await readUsers()
  if (users.length === 0) {
    const password = generateRandomPassword()
    await createUser("admin", password, "Administrator", "Admin")
    console.warn("\n============================================================")
    console.warn("  SECURITY: Default admin account created")
    console.warn("  Username: admin")
    console.warn("  Password: " + password)
    console.warn("  Log in and change this password immediately.")
    console.warn("============================================================\n")
  }
}

/* ───────────────────────────  SESSION / AUTH  ─────────────────────────── */

function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET
  if (secret && secret.length >= 32) {
    return secret
  }

  // In production, SESSION_SECRET is mandatory
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "SESSION_SECRET environment variable is required and must be at least 32 characters. " +
      "Set it in your hosting platform before deploying."
    )
  }

  // Dev fallback — app works but warns loudly
  console.warn(
    "\n[SECURITY WARNING] SESSION_SECRET not set or too short.\n" +
    "Using temporary dev fallback. Sessions will NOT be secure.\n" +
    "Set SESSION_SECRET in .env.local before any production use.\n"
  )
  return "dev-session-secret-do-not-use-in-production-1234567890"
}

function signSession(payload: SessionPayload): string {
  const secret = getSessionSecret()
  const data = JSON.stringify(payload)
  const signature = crypto.createHmac("sha256", secret).update(data).digest("hex")
  return Buffer.from(`${data}.${signature}`).toString("base64")
}

function verifySession(token: string): SessionPayload | null {
  try {
    const decoded = Buffer.from(token, "base64").toString("utf-8")
    const lastDot = decoded.lastIndexOf(".")
    if (lastDot === -1) return null
    const data = decoded.slice(0, lastDot)
    const signature = decoded.slice(lastDot + 1)
    const secret = getSessionSecret()
    const expected = crypto.createHmac("sha256", secret).update(data).digest("hex")
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null
    return JSON.parse(data) as SessionPayload
  } catch {
    return null
  }
}

export async function authenticateUser(username: string, password: string): Promise<SessionPayload | null> {
  await ensureDefaultAdmin()
  const user = await getUserByUsername(username)
  if (!user) return null
  if (!verifyPassword(password, user.passwordHash)) return null
  return { userId: user.id, username: user.username, role: user.role, name: user.name }
}

export async function setSessionCookie(payload: SessionPayload) {
  const cookieStore = await cookies()
  const token = signSession(payload)
  cookieStore.set(ADMIN_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  })
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(ADMIN_COOKIE_NAME)
  if (!token?.value) return null
  return verifySession(token.value)
}

export async function isAdminAuthenticated(): Promise<boolean> {
  const session = await getSession()
  return session !== null
}

export async function clearAdminCookie() {
  const cookieStore = await cookies()
  cookieStore.delete(ADMIN_COOKIE_NAME)
}

export { hasPermission, ROLE_PERMISSIONS } from "./admin-types"

// Alias for backward compatibility
export async function setAdminCookie() {
  // No-op: use setSessionCookie with real payload instead
}
