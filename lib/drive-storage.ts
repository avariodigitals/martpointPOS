/* ───────────────────────  Google Drive uploads (server-only)  ───────────────────────
 * Client/lead/partner/creator uploads are filed into a shared Google Drive instead
 * of (or as well as) Supabase Storage, so the operations team can browse them
 * directly. Every file lands under a top-level folder per owner TYPE, then a
 * subfolder named after the owner's ID:
 *
 *   MartPoint Uploads/
 *     ├── Business/<business_id>/…
 *     ├── Lead/<lead_id>/…
 *     ├── Partner/<partner_id>/…
 *     ├── Creator/<creator_id>/…
 *     └── Admin/<admin_id>/…
 *
 * Folders are created on demand (an upload to a missing folder creates it). Folder
 * IDs are cached in `drive_folder_refs` so we do not re-query Drive on every upload.
 *
 * Auth reuses the SAME Google account/OAuth client as Google Meet (lib/google-calendar.ts)
 * but needs the `drive.file` scope, so the admin must reconnect Google once after
 * this ships.
 *
 * Uses fetch only — no googleapis dependency.
 */

import { supabase, isSupabaseConfigured } from "./supabase"
import { getGoogleSettings, isGoogleConnected, clearGoogleSettingsCache, type GoogleSettings } from "./google-calendar"

export const DRIVE_API_BASE = "https://www.googleapis.com/drive/v3"
export const DRIVE_UPLOAD_BASE = "https://www.googleapis.com/upload/drive/v3"
export const DRIVE_FOLDER_MIME = "application/vnd.google-apps.folder"

export const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file"

/** The five top-level folders. Order is the canonical display order. */
export const DRIVE_OWNER_TYPES = ["business", "lead", "partner", "creator", "admin"] as const
export type DriveOwnerType = (typeof DRIVE_OWNER_TYPES)[number]

/** Human-readable top-level folder names, keyed by owner type. */
export const DRIVE_OWNER_FOLDERS: Record<DriveOwnerType, string> = {
  business: "Business",
  lead: "Lead",
  partner: "Partner",
  creator: "Creator",
  admin: "Admin",
}

/** Only these upload mime types are accepted. Docs, sheets and images cover the
 *  product lists, production sheets and payment proofs clients send us. */
export const ALLOWED_DRIVE_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/heic",
  "application/pdf",
  "text/csv",
  "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/zip",
]

export const MAX_DRIVE_FILE_BYTES = 15 * 1024 * 1024 // 15 MB — Vercel serverless payload limit
export const MAX_DRIVE_UPLOAD_FILES = 25

export interface DriveSettings {
  /** Root folder name created under My Drive when `rootFolderId` is empty. */
  rootFolderName: string
  /** Explicit Drive folder ID to use as the root (shared drive or pre-made folder). */
  rootFolderId: string
  /** Owner of the folder tree — the connected Google account, or a Shared Drive ID. */
  sharedDriveId: string
  /** Whether to also mirror uploads into Supabase Storage. */
  mirrorToSupabase: boolean
}

export const DEFAULT_DRIVE_SETTINGS: DriveSettings = {
  rootFolderName: "MartPoint Uploads",
  rootFolderId: "",
  sharedDriveId: "",
  mirrorToSupabase: false,
}

const CACHE_TTL_MS = 10_000
let accessToken: { value: string; expiresAt: number } | null = null
let cachedSettings: DriveSettings | null = null
let cachedSettingsAt = 0

function normalizeDriveSettings(raw: Record<string, unknown> | undefined): DriveSettings {
  const value = raw || {}
  return {
    rootFolderName: String(value.rootFolderName || DEFAULT_DRIVE_SETTINGS.rootFolderName),
    rootFolderId: String(value.rootFolderId || ""),
    sharedDriveId: String(value.sharedDriveId || ""),
    mirrorToSupabase: Boolean(value.mirrorToSupabase),
  }
}

/** Read the Drive block out of settings.data.drive (backend-managed, admin editable). */
export async function getDriveSettings(): Promise<DriveSettings> {
  const now = Date.now()
  if (cachedSettings && now - cachedSettingsAt < CACHE_TTL_MS) return cachedSettings
  let raw: Record<string, unknown> | undefined
  if (isSupabaseConfigured()) {
    const { data } = await supabase.from("settings").select("data").eq("id", 1).single()
    raw = ((data?.data as Record<string, unknown> | undefined)?.drive as Record<string, unknown> | undefined)
  }
  cachedSettings = normalizeDriveSettings(raw)
  cachedSettingsAt = now
  return cachedSettings
}

/** Shallow-merge a patch into settings.data.drive. */
export async function saveDriveSettings(patch: Partial<DriveSettings>): Promise<boolean> {
  if (!isSupabaseConfigured()) return false
  const { data } = await supabase.from("settings").select("data").eq("id", 1).single()
  const all = ((data?.data as Record<string, unknown> | undefined) || {}) as Record<string, unknown>
  const drive = ((all.drive as Record<string, unknown> | undefined) || {}) as Record<string, unknown>
  const next = { ...all, drive: { ...drive, ...patch } }
  const { error } = await supabase.from("settings").upsert({ id: 1, data: next, updated_at: new Date().toISOString() })
  if (error) {
    console.error("[drive] failed to save settings:", error.message)
    return false
  }
  clearDriveCache()
  return true
}

export function clearDriveCache() {
  cachedSettings = null
  cachedSettingsAt = 0
  accessToken = null
}

/** A Drive upload needs a connected Google account that granted the drive.file scope. */
export function isDriveReady(s: GoogleSettings): boolean {
  return isGoogleConnected(s)
}

export function validateDriveFile(file: { type: string; size: number }): string | null {
  const type = (file.type || "").toLowerCase()
  if (!ALLOWED_DRIVE_MIME_TYPES.includes(type)) {
    return "File type not allowed. Accepted: images, PDF, Word, Excel, PowerPoint, CSV, text and ZIP."
  }
  if (file.size > MAX_DRIVE_FILE_BYTES) {
    return "File too large. Maximum size is 15 MB."
  }
  return null
}

export function sanitizeDriveFilename(name: string): string {
  const base = (name || "")
    .replace(/[\\/]+/g, "-")
    .replace(/[<>:"|?*\u0000-\u001f]/g, "")
    .trim()
    .slice(0, 160)
  return base || "file"
}

/** Normalise an arbitrary owner id into a safe folder-name segment. */
export function sanitizeFolderSegment(segment: string): string {
  const base = (segment || "").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120)
  // A value made only of separator characters carries no meaning — treat it as absent.
  return /^[._-]+$/.test(base) ? "unknown" : base || "unknown"
}

async function getAccessToken(): Promise<string> {
  const settings = await getGoogleSettings()
  if (!isDriveReady(settings)) throw new Error("Google account not connected")

  if (accessToken && accessToken.expiresAt > Date.now() + 30_000) return accessToken.value

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: settings.clientId,
      client_secret: settings.clientSecret,
      refresh_token: settings.refreshToken,
      grant_type: "refresh_token",
    }),
  })
  const json = (await res.json()) as Record<string, unknown>
  if (!res.ok || !json.access_token) {
    throw new Error(String(json.error_description || json.error || "Failed to refresh Google access token"))
  }
  accessToken = {
    value: String(json.access_token),
    expiresAt: Date.now() + (Number(json.expires_in) || 3600) * 1000,
  }
  return accessToken.value
}

interface DriveFileRef {
  id: string
  name: string
  webViewLink?: string
}

async function driveJson<T>(path: string, init: RequestInit & { query?: Record<string, string> } = {}): Promise<T> {
  const token = await getAccessToken()
  const settings = await getDriveSettings()
  const url = new URL(`${DRIVE_API_BASE}${path}`)
  for (const [k, v] of Object.entries(init.query || {})) url.searchParams.set(k, v)
  if (settings.sharedDriveId) {
    url.searchParams.set("supportsAllDrives", "true")
    url.searchParams.set("includeItemsFromAllDrives", "true")
  }
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  })
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (!res.ok) {
    const err = json.error as Record<string, unknown> | undefined
    throw new Error(String(err?.message || `Google Drive request failed (${res.status})`))
  }
  return json as T
}

/** Escape a value for Drive's `q` search syntax. */
function escapeQueryValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'")
}

/* ─── Folder lookups (cached in drive_folder_refs) ─── */

function ownerScopeKey(ownerType: DriveOwnerType, ownerId: string): string {
  return `${ownerType}:${sanitizeFolderSegment(ownerId)}`
}

async function readFolderRef(scopeKey: string): Promise<string | null> {
  if (!isSupabaseConfigured()) return null
  const { data } = await supabase
    .from("drive_folder_refs")
    .select("drive_folder_id")
    .eq("scope_key", scopeKey)
    .maybeSingle()
  return (data as { drive_folder_id?: string } | null)?.drive_folder_id || null
}

async function writeFolderRef(
  ownerType: DriveOwnerType,
  ownerId: string,
  folderName: string,
  driveFolderId: string
): Promise<void> {
  if (!isSupabaseConfigured()) return
  const scopeKey = ownerScopeKey(ownerType, ownerId)
  const { error } = await supabase
    .from("drive_folder_refs")
    .upsert(
      {
        owner_type: ownerType,
        scope_key: scopeKey,
        folder_name: folderName,
        drive_folder_id: driveFolderId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "scope_key" }
    )
  if (error) console.error("[drive] failed to cache folder ref:", error.message)
}

async function findFolder(name: string, parentId: string | null): Promise<DriveFileRef | null> {
  const settings = await getDriveSettings()
  const clauses = [
    `mimeType = '${DRIVE_FOLDER_MIME}'`,
    `name = '${escapeQueryValue(name)}'`,
    "trashed = false",
  ]
  clauses.push(parentId ? `'${escapeQueryValue(parentId)}' in parents` : "'root' in parents")

  const json = await driveJson<{ files?: DriveFileRef[] }>("/files", {
    method: "GET",
    query: {
      q: clauses.join(" and "),
      fields: "files(id,name,webViewLink)",
      pageSize: "10",
      ...(settings.sharedDriveId ? { driveId: settings.sharedDriveId, corpora: "drive" } : {}),
    },
  })
  return json.files?.[0] ?? null
}

async function createFolder(name: string, parentId: string | null): Promise<DriveFileRef> {
  const settings = await getDriveSettings()
  const json = await driveJson<DriveFileRef>("/files", {
    method: "POST",
    query: {
      fields: "id,name,webViewLink",
      ...(settings.sharedDriveId ? { supportsAllDrives: "true" } : {}),
    },
    body: JSON.stringify({
      name,
      mimeType: DRIVE_FOLDER_MIME,
      ...(parentId ? { parents: [parentId] } : {}),
    }),
  })
  return json
}

/** Find-or-create a folder by name under a parent. */
async function ensureFolder(name: string, parentId: string | null): Promise<DriveFileRef> {
  const existing = await findFolder(name, parentId)
  if (existing) return existing
  return createFolder(name, parentId)
}

/**
 * Resolve (creating as needed) the folder for an owner:
 *   <root>/<Owner Type>/<owner id>
 * Returns the leaf folder id + a web view link to the owner folder.
 */
export async function ensureOwnerFolder(
  ownerType: DriveOwnerType,
  ownerId: string
): Promise<{ folderId: string; webViewLink?: string }> {
  const settings = await getDriveSettings()
  const scopeKey = ownerScopeKey(ownerType, ownerId)

  const cachedId = await readFolderRef(scopeKey)
  if (cachedId) {
    try {
      const meta = await driveJson<DriveFileRef>(`/files/${cachedId}`, {
        method: "GET",
        query: { fields: "id,name,webViewLink" },
      })
      if (meta?.id) return { folderId: meta.id, webViewLink: meta.webViewLink }
    } catch {
      // Folder was deleted/renamed in Drive — fall through and re-create it.
    }
  }

  const root = settings.rootFolderId
    ? { id: settings.rootFolderId, webViewLink: undefined as string | undefined }
    : await ensureFolder(settings.rootFolderName, null)
  const top = await ensureFolder(DRIVE_OWNER_FOLDERS[ownerType], root.id)
  const leaf = await ensureFolder(sanitizeFolderSegment(ownerId), top.id)

  await writeFolderRef(ownerType, ownerId, DRIVE_OWNER_FOLDERS[ownerType], top.id)
  // Cache the leaf against the owner scope so later lookups are one query.
  await writeFolderRef(ownerType, ownerId, sanitizeFolderSegment(ownerId), leaf.id)

  return { folderId: leaf.id, webViewLink: leaf.webViewLink }
}

/* ─── Uploads ─── */

export interface DriveUploadResult {
  ok: boolean
  fileId?: string
  name?: string
  webViewLink?: string
  error?: string
}

/** Upload one file into a folder. Uses multipart/related so metadata + bytes go in one call. */
export async function uploadFileToFolder(
  folderId: string,
  filename: string,
  mimeType: string,
  bytes: ArrayBuffer
): Promise<DriveUploadResult> {
  const settings = await getDriveSettings()
  const token = await getAccessToken()
  const safeName = sanitizeDriveFilename(filename)

  const boundary = `mp_${Date.now()}_${Math.random().toString(36).slice(2)}`
  const metadata = JSON.stringify({ name: safeName, parents: [folderId] })
  const preamble =
    `--${boundary}\r\n` +
    "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
    `${metadata}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: ${mimeType || "application/octet-stream"}\r\n\r\n`
  const closing = `\r\n--${boundary}--`

  const body = new Blob([preamble, new Uint8Array(bytes), closing])

  const url = new URL(`${DRIVE_UPLOAD_BASE}/files`)
  url.searchParams.set("uploadType", "multipart")
  url.searchParams.set("fields", "id,name,webViewLink")
  if (settings.sharedDriveId) url.searchParams.set("supportsAllDrives", "true")

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    body,
  })
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (!res.ok) {
    const err = json.error as Record<string, unknown> | undefined
    return { ok: false, error: String(err?.message || `Google Drive upload failed (${res.status})`) }
  }
  return {
    ok: true,
    fileId: String(json.id || ""),
    name: String(json.name || safeName),
    webViewLink: (json.webViewLink as string) || undefined,
  }
}

/** Owner types accepted from an API caller, mapped from loose user input. */
export function normalizeOwnerType(input: string | null | undefined): DriveOwnerType | null {
  const value = (input || "").trim().toLowerCase()
  if ((DRIVE_OWNER_TYPES as readonly string[]).includes(value)) return value as DriveOwnerType
  const aliases: Record<string, DriveOwnerType> = {
    businesses: "business",
    client: "business",
    clients: "business",
    customer: "business",
    customers: "business",
    leads: "lead",
    quotation: "lead",
    estimate: "lead",
    partners: "partner",
    creators: "creator",
    staff: "admin",
    team: "admin",
    user: "admin",
    users: "admin",
  }
  return aliases[value] ?? null
}

export { clearGoogleSettingsCache }
