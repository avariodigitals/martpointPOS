"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, Save, HardDrive, CheckCircle2, AlertTriangle, FolderTree } from "lucide-react"

interface DriveStatus {
  ready: boolean
  needsReconnect: boolean
  scopesUnknown: boolean
  googleEmail: string | null
  grantedScopes: string
  scope: string
  settings: {
    rootFolderName: string
    rootFolderId: string
    sharedDriveId: string
    mirrorToSupabase: boolean
  }
  ownerFolders: Record<string, string>
}

const inputClass = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
const labelClass = "block text-sm font-medium mb-1"

export function DriveSettingsCard({ className = "" }: { className?: string }) {
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<DriveStatus | null>(null)
  const [form, setForm] = useState({
    rootFolderName: "MartPoint Uploads",
    rootFolderId: "",
    sharedDriveId: "",
    mirrorToSupabase: false,
  })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")

  useEffect(() => {
    fetch("/api/admin/drive", { cache: "no-store" })
      .then((r) => r.json())
      .then((data: DriveStatus) => {
        if (data?.settings) {
          setStatus(data)
          setForm({
            rootFolderName: data.settings.rootFolderName || "MartPoint Uploads",
            rootFolderId: data.settings.rootFolderId || "",
            sharedDriveId: data.settings.sharedDriveId || "",
            mirrorToSupabase: Boolean(data.settings.mirrorToSupabase),
          })
        }
      })
      .catch(() => setStatus(null))
      .finally(() => setLoading(false))
  }, [])

  const save = async () => {
    setSaving(true)
    setMessage("")
    try {
      const res = await fetch("/api/admin/drive", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (data.success) {
        setMessage("Drive upload settings saved.")
      } else {
        setMessage(data.error || "Failed to save Drive settings")
      }
    } catch {
      setMessage("Failed to save Drive settings")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className={className} id="drive-uploads">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HardDrive className="w-5 h-5" />
          Client Drive Uploads
        </CardTitle>
        <CardDescription>
          Client, lead, partner and creator uploads are filed into a shared Google Drive as
          {" "}<strong>Root / Business|Lead|Partner|Creator|Admin / &lt;record ID&gt;</strong>. Folders are created
          automatically the first time someone uploads for that record.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {loading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div
              className={`flex items-start gap-2 rounded-md border p-3 text-sm ${
                status?.ready
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-amber-200 bg-amber-50 text-amber-800"
              }`}
            >
              {status?.ready ? (
                <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              )}
              <div>
                {status?.ready ? (
                  <p>
                    Google Drive is connected{status.googleEmail ? ` as ${status.googleEmail}` : ""} and has the Drive
                    permission. Uploads will be filed automatically.
                  </p>
                ) : (
                  <div className="space-y-2">
                    <p>
                      <strong>
                        {status?.needsReconnect
                          ? "Drive permission not granted — reconnect Google."
                          : "No Google account is connected."}
                      </strong>{" "}
                      {status?.needsReconnect
                        ? "A Google account is connected, but it was authorised before Drive uploads were added. Permissions are fixed when you consent, so the account must be reconnected once."
                        : "Use “Connect Google” in the Google Meet section below to authorise Drive uploads."}
                    </p>
                    <ol className="list-decimal list-inside space-y-0.5 text-xs">
                      <li>
                        Go to the <strong>Google Meet</strong> section below and click <strong>Disconnect</strong>.
                      </li>
                      <li>
                        Click <strong>Connect Google</strong> and accept the Google Drive permission on the consent screen.
                      </li>
                      <li>Come back here — this banner turns green when Drive is ready.</li>
                    </ol>
                    {status?.grantedScopes ? (
                      <details className="text-xs">
                        <summary className="cursor-pointer">Currently granted permissions</summary>
                        <p className="mt-1 break-all font-mono">{status.grantedScopes}</p>
                        <p className="mt-1">
                          Missing: <span className="font-mono">{status.scope}</span>
                        </p>
                      </details>
                    ) : status?.scopesUnknown ? (
                      <p className="text-xs">
                        The permissions this account granted are unknown because it was connected before we started
                        recording them. Reconnecting will tell us definitively.
                      </p>
                    ) : null}
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className={labelClass}>Root folder name</label>
              <input
                value={form.rootFolderName}
                onChange={(e) => setForm({ ...form, rootFolderName: e.target.value })}
                className={inputClass}
                placeholder="MartPoint Uploads"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Created in the connected Google account&apos;s My Drive when no root folder ID is set below.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>Root folder ID (optional)</label>
                <input
                  value={form.rootFolderId}
                  onChange={(e) => setForm({ ...form, rootFolderId: e.target.value })}
                  className={inputClass}
                  placeholder="1AbC… (from the folder URL)"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Point uploads at an existing/shared folder instead of creating one.
                </p>
              </div>
              <div>
                <label className={labelClass}>Shared Drive ID (optional)</label>
                <input
                  value={form.sharedDriveId}
                  onChange={(e) => setForm({ ...form, sharedDriveId: e.target.value })}
                  className={inputClass}
                  placeholder="0AEd…"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Use when the tree lives in a Google Shared Drive rather than My Drive.
                </p>
              </div>
            </div>

            <div className="rounded-md border border-border p-3">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <FolderTree className="w-3.5 h-3.5" />
                Folder structure
              </p>
              <ul className="mt-2 space-y-1 text-sm font-mono text-muted-foreground">
                {Object.entries(status?.ownerFolders || {}).map(([type, name]) => (
                  <li key={type}>
                    {form.rootFolderName || "MartPoint Uploads"}/{name}/&lt;{type === "business" ? "business" : type}_id&gt;/
                  </li>
                ))}
              </ul>
            </div>

            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.mirrorToSupabase}
                onChange={(e) => setForm({ ...form, mirrorToSupabase: e.target.checked })}
                className="rounded border-input mt-0.5"
              />
              <span>
                Also keep a copy in Supabase Storage
                <span className="block text-xs text-muted-foreground">
                  Off by default — Google Drive stays the system of record.
                </span>
              </span>
            </label>

            {message && <p className="text-xs text-muted-foreground">{message}</p>}
          </>
        )}
      </CardContent>
      <CardFooter className="justify-end">
        <Button onClick={save} disabled={saving || loading}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
          Save Drive Settings
        </Button>
      </CardFooter>
    </Card>
  )
}
