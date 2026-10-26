"use client"

import { useEffect, useState } from "react"
import { CheckCircle2, ExternalLink, Loader2, RefreshCw, Unplug } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

type Connection = { display_name: string | null; username: string | null; status: string; last_synced_at: string | null; last_sync_error: string | null; scopes: string[] }
const connectionNotices: Record<string, string> = {
  connected: "TikTok is connected. Eligible submitted posts will be checked automatically.",
  denied: "TikTok authorization was cancelled. You can connect it whenever you’re ready.",
  setup: "TikTok linking is not configured yet. Please try again later.",
  state: "The secure connection expired. Start linking again.",
  authorization: "TikTok could not authorize the account. Please try again.",
  profile: "We could not verify the TikTok account returned by TikTok.",
  save: "TikTok was authorized, but MartPoint could not save the connection. Contact support.",
}

export function SocialConnections({ notice }: { notice?: string }) {
  const [configured, setConfigured] = useState(false)
  const [connection, setConnection] = useState<Connection | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(() => notice ? connectionNotices[notice] || "" : "")

  useEffect(() => {
    let active = true
    fetch("/api/creator/social-accounts/tiktok", { cache: "no-store" })
      .then(async (response) => ({ response, data: await response.json() }))
      .then(({ response, data }) => {
        if (!active) return
        if (response.ok) { setConfigured(Boolean(data.configured)); setConnection(data.connection || null) }
        else setMessage(data.error || "Could not load connected accounts.")
      })
      .catch(() => { if (active) setMessage("Could not load connected accounts.") })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  async function connect() {
    setBusy(true); setMessage("")
    try {
      const response = await fetch("/api/creator/social-accounts/tiktok", { method: "POST" })
      const data = await response.json()
      if (!response.ok || !data.url) { setMessage(data.error || "Could not start TikTok linking."); return }
      window.location.assign(data.url)
    } catch { setMessage("Could not start TikTok linking.") }
    finally { setBusy(false) }
  }

  async function disconnect() {
    if (!window.confirm("Disconnect TikTok? Existing challenge metrics will remain, but no new snapshots will be collected.")) return
    setBusy(true)
    try {
      const response = await fetch("/api/creator/social-accounts/tiktok", { method: "DELETE" })
      const data = await response.json()
      if (!response.ok) { setMessage(data.error || "Could not disconnect TikTok."); return }
      setConnection(null); setMessage("TikTok disconnected. Existing metrics are retained.")
    } catch { setMessage("Could not disconnect TikTok.") }
    finally { setBusy(false) }
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-sm font-medium">Automatic social performance</CardTitle></CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 font-medium">TikTok {connection?.status === "CONNECTED" && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}</div>
            {connection?.status === "CONNECTED" ? (
              <p className="mt-1 text-muted-foreground">Connected as {connection.display_name || connection.username || "TikTok creator"}{connection.last_synced_at ? ` · Last checked ${new Date(connection.last_synced_at).toLocaleString("en-NG")}` : " · Waiting for first sync"}</p>
            ) : connection?.status === "REAUTH_REQUIRED" ? (
              <p className="mt-1 text-amber-700">Authorization needs renewal. Reconnect to resume automatic checks.</p>
            ) : (
              <p className="mt-1 text-muted-foreground">Connect your account so eligible challenge video views, likes, comments and shares can be verified automatically.</p>
            )}
            {connection?.last_sync_error && <p className="mt-1 text-rose-700">Latest sync issue: {connection.last_sync_error}</p>}
          </div>
          {loading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : connection?.status === "CONNECTED" ? (
            <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void disconnect()}><Unplug className="mr-2 h-4 w-4" />Disconnect</Button>
          ) : (
            <Button type="button" size="sm" disabled={busy || !configured} onClick={() => void connect()}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ExternalLink className="mr-2 h-4 w-4" />}{connection ? "Reconnect TikTok" : "Connect TikTok"}</Button>
          )}
        </div>
        {message && <p role="status" className="text-muted-foreground">{message}</p>}
        {!configured && !loading && <p className="text-xs text-muted-foreground">Account linking will appear once MartPoint enables its TikTok developer connection.</p>}
        <div className="flex items-start gap-2 text-xs text-muted-foreground"><RefreshCw className="mt-0.5 h-3.5 w-3.5 shrink-0" /><p>Metrics are collected from the platform for submitted public TikTok videos. Link only your own post. MartPoint referral clicks and leads are tracked separately.</p></div>
      </CardContent>
    </Card>
  )
}
