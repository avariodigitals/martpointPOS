import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { NextResponse } from "next/server"
import crypto from "crypto"
import type { User, UserRole, SessionPayload, AdminAction } from "./admin-types"
import { authorize } from "./admin-types"
import { supabase, isSupabaseConfigured } from "./supabase"
import { hashPassword, verifyPassword } from "./crypto"
import { signSession, verifySession } from "./session-secret"
export type { User, UserRole, SessionPayload }

const ADMIN_COOKIE_NAME = "admin-session"

/* ───────────────────────────  USER STORE (Supabase)  ─────────────────────────── */

function mapUser(row: Record<string, unknown>): User {
  return {
    id: row.id as string,
    username: row.username as string,
    name: row.name as string,
    passwordHash: row.password_hash as string,
    role: row.role as UserRole,
    status: (row.status as "ACTIVE" | "DISABLED") ?? "ACTIVE",
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
    status: "ACTIVE",
    createdAt: new Date().toISOString(),
  }
  if (isSupabaseConfigured()) {
    await supabase.from("users").insert({
      id: user.id,
      username: user.username,
      name: user.name,
      password_hash: user.passwordHash,
      role: user.role,
      status: user.status,
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

  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (updates.username) updateData.username = updates.username
  if (updates.name) updateData.name = updates.name
  if (updates.role) updateData.role = updates.role
  if (updates.status) updateData.status = updates.status
  if (updates.password) updateData.password_hash = hashPassword(updates.password)

  const { data: updated } = await supabase.from("users").update(updateData).eq("id", id).select().single()
  if (!updated) return null
  return mapUser(updated)
}

export async function deleteUser(id: string): Promise<boolean> {
  return disableUser(id)
}

export async function disableUser(id: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false
  const { error } = await supabase
    .from("users")
    .update({ status: "DISABLED", updated_at: new Date().toISOString() })
    .eq("id", id)
  return !error
}

export async function enableUser(id: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false
  const { error } = await supabase
    .from("users")
    .update({ status: "ACTIVE", updated_at: new Date().toISOString() })
    .eq("id", id)
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

function isSessionPayload(value: unknown): value is SessionPayload {
  if (!value || typeof value !== "object") return false
  const v = value as Record<string, unknown>
  return (
    typeof v.userId === "string" &&
    typeof v.username === "string" &&
    typeof v.role === "string" &&
    typeof v.name === "string"
  )
}

export async function authenticateUser(username: string, password: string): Promise<SessionPayload | null> {
  await ensureDefaultAdmin()
  const user = await getUserByUsername(username)
  if (!user) return null
  if (user.status !== "ACTIVE") return null
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
  return verifySession(token.value, isSessionPayload)
}

export async function isAdminAuthenticated(): Promise<boolean> {
  const session = await getSession()
  return session !== null
}

export async function clearAdminCookie() {
  const cookieStore = await cookies()
  cookieStore.delete(ADMIN_COOKIE_NAME)
}

export { hasPermission, ROLE_PERMISSIONS, authorize, ALL_ROLES, ROLE_DESCRIPTIONS } from "./admin-types"
export type { AdminAction } from "./admin-types"

// Alias for backward compatibility
export async function setAdminCookie() {
  // No-op: use setSessionCookie with real payload instead
}

/* ───────────────────────────  Route-handler guard  ───────────────────────────
 * Server-side authorization for API routes. Returns either a 401/403
 * NextResponse (denied) or null (authorized). This is the security boundary
 * for all admin APIs — never rely on client-side PermissionGuard alone.
 */
export async function authorizeAdmin(
  page: string,
  action?: AdminAction,
  resource?: string
): Promise<{ session: SessionPayload; denied: null } | { session: null; denied: Response }> {
  const session = await getSession()
  if (!session) {
    return {
      session: null,
      denied: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    }
  }
  if (!authorize(session, page, action, resource)) {
    return {
      session: null,
      denied: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    }
  }
  return { session, denied: null }
}

/* ───────────────────────────  Server page guard  ───────────────────────────
 * For server components / layouts. Returns the session if authorized, or
 * redirects to /admin/login (no session) or a forbidden page.
 */
export async function requireAdminPage(
  page: string,
  action?: AdminAction
): Promise<SessionPayload> {
  const session = await getSession()
  if (!session) {
    redirect("/admin/login")
  }
  if (!authorize(session, page, action)) {
    redirect("/admin")
  }
  return session as SessionPayload
}
