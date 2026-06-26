import { cookies } from "next/headers"
import fs from "fs"
import path from "path"
import crypto from "crypto"
import type { User, UserRole, SessionPayload } from "./admin-types"
export type { User, UserRole, SessionPayload }

const ADMIN_COOKIE_NAME = "admin-session"
const usersPath = path.join(process.cwd(), "data", "users.json")

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

/* ───────────────────────────  USER STORE  ─────────────────────────── */

function readUsers(): User[] {
  try {
    if (!fs.existsSync(usersPath)) return []
    const data = fs.readFileSync(usersPath, "utf-8")
    return (JSON.parse(data).users || []) as User[]
  } catch {
    return []
  }
}

export function writeUsers(users: User[]) {
  const dir = path.dirname(usersPath)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(usersPath, JSON.stringify({ users }, null, 2), "utf-8")
}

export function getUserByUsername(username: string): User | undefined {
  return readUsers().find((u) => u.username.toLowerCase() === username.toLowerCase())
}

export function getUserById(id: string): User | undefined {
  return readUsers().find((u) => u.id === id)
}

export function getAllUsers(): User[] {
  return readUsers()
}

export function createUser(
  username: string,
  password: string,
  name: string,
  role: UserRole
): User {
  const users = readUsers()
  const user: User = {
    id: crypto.randomUUID(),
    username: username.toLowerCase().trim(),
    name: name.trim(),
    passwordHash: hashPassword(password),
    role,
    createdAt: new Date().toISOString(),
  }
  users.push(user)
  writeUsers(users)
  return user
}

export function updateUser(id: string, updates: Partial<Omit<User, "id" | "createdAt" | "passwordHash"> & { password?: string }>): User | null {
  const users = readUsers()
  const idx = users.findIndex((u) => u.id === id)
  if (idx === -1) return null
  const next = { ...users[idx], ...updates } as User
  if (updates.password) {
    next.passwordHash = hashPassword(updates.password)
    delete (next as unknown as Record<string, unknown>).password
  }
  users[idx] = next
  writeUsers(users)
  return users[idx]
}

export function deleteUser(id: string): boolean {
  const users = readUsers()
  const filtered = users.filter((u) => u.id !== id)
  if (filtered.length === users.length) return false
  writeUsers(filtered)
  return true
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

export function ensureDefaultAdmin() {
  const users = readUsers()
  if (users.length === 0) {
    const password = generateRandomPassword()
    createUser("admin", password, "Administrator", "Admin")
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
  ensureDefaultAdmin()
  const user = getUserByUsername(username)
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
