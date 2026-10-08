import { NextResponse } from "next/server"
import { authorizeAdmin, getSession } from "@/lib/admin-auth"
import { getGoogleSettings, canUseDrive, grantedScopesUnknown, GOOGLE_DRIVE_SCOPE } from "@/lib/google-calendar"
import {
  DRIVE_OWNER_FOLDERS,
  getDriveSettings,
  saveDriveSettings,
  type DriveSettings,
} from "@/lib/drive-storage"

/* ─── GET Drive upload readiness + current settings (any admin) ─── */
export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const google = await getGoogleSettings()
  const drive = await getDriveSettings()

  // `ready` reflects whether the connected account actually GRANTED the Drive
  // scope. A refresh token alone is not enough — scopes are fixed at consent
  // time, so an account connected before Drive was added must reconnect.
  const ready = canUseDrive(google)
  const needsReconnect = Boolean(google.refreshToken) && !ready

  return NextResponse.json({
    ready,
    needsReconnect,
    scopesUnknown: grantedScopesUnknown(google),
    googleEmail: google.email || null,
    grantedScopes: google.grantedScopes,
    scope: GOOGLE_DRIVE_SCOPE,
    settings: drive,
    ownerFolders: DRIVE_OWNER_FOLDERS,
  })
}

/* ─── PATCH update the Drive upload settings ─── */
export async function PATCH(request: Request) {
  const auth = await authorizeAdmin("settings")
  if (auth.denied) return auth.denied

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const patch: Partial<DriveSettings> = {}
  if (body.rootFolderName !== undefined) patch.rootFolderName = String(body.rootFolderName).slice(0, 120)
  if (body.rootFolderId !== undefined) patch.rootFolderId = String(body.rootFolderId).slice(0, 200)
  if (body.sharedDriveId !== undefined) patch.sharedDriveId = String(body.sharedDriveId).slice(0, 200)
  if (body.mirrorToSupabase !== undefined) patch.mirrorToSupabase = Boolean(body.mirrorToSupabase)

  const ok = await saveDriveSettings(patch)
  if (!ok) return NextResponse.json({ error: "Failed to save Drive settings" }, { status: 500 })

  return NextResponse.json({ success: true, settings: await getDriveSettings() })
}
