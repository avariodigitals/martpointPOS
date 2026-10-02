"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, Plus, Pencil, Trash2, Star, Check, X, Clock } from "lucide-react"

const PLATFORMS = [
  { value: "TIKTOK", label: "TikTok" },
  { value: "INSTAGRAM", label: "Instagram" },
  { value: "YOUTUBE", label: "YouTube" },
  { value: "FACEBOOK", label: "Facebook" },
  { value: "X", label: "X (Twitter)" },
  { value: "LINKEDIN", label: "LinkedIn" },
  { value: "OTHER", label: "Other" },
]

const platformLabel = (p: string) => PLATFORMS.find((x) => x.value === p)?.label || p

const inputCls = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm"

export interface SocialRow {
  id: string
  platform: string
  profileUrl: string
  username: string | null
  followers: number | null
  isPrimary: boolean
}

interface ChangeRequest {
  id: string
  requestType: "ADD" | "UPDATE" | "REMOVE"
  payload: { platform?: string; profileUrl?: string; username?: string | null; followers?: number | null }
  note: string | null
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED"
  reviewNote: string | null
  createdAt: string
}

const requestTypeLabel: Record<string, string> = {
  ADD: "Add profile",
  UPDATE: "Change profile",
  REMOVE: "Remove profile",
}

interface Draft {
  platform: string
  profileUrl: string
  username: string
  followers: string
  note: string
}

const emptyDraft: Draft = { platform: "TIKTOK", profileUrl: "", username: "", followers: "", note: "" }

export function SocialsManager({ initial }: { initial: SocialRow[] }) {
  const [rows, setRows] = useState<SocialRow[]>(initial)
  const [requests, setRequests] = useState<ChangeRequest[]>([])
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft>({ ...emptyDraft })
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    fetch("/api/creator/profile/socials")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.requests) setRequests(d.requests) })
      .catch(() => {})
  }, [])

  async function refreshRequests() {
    try {
      const res = await fetch("/api/creator/profile/socials")
      const d = res.ok ? await res.json() : null
      if (d?.requests) setRequests(d.requests)
    } catch {
      // best-effort
    }
  }

  function draftPayload(d: Draft) {
    return {
      platform: d.platform,
      profileUrl: d.profileUrl.trim(),
      username: d.username.trim() || null,
      followers: d.followers ? Number(d.followers) : null,
      note: d.note.trim() || null,
    }
  }

  async function addRow() {
    setBusy(true)
    setMessage(null)
    try {
      const res = await fetch("/api/creator/profile/socials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draftPayload(draft)),
      })
      const data = await res.json()
      if (!res.ok) {
        setMessage({ ok: false, text: data.error || "Failed to submit request." })
        return
      }
      setDraft({ ...emptyDraft })
      setAdding(false)
      setMessage({ ok: true, text: "Request submitted — it appears once the MartPoint team approves it." })
      await refreshRequests()
    } finally {
      setBusy(false)
    }
  }

  async function saveEdit(id: string) {
    setBusy(true)
    setMessage(null)
    try {
      const res = await fetch("/api/creator/profile/socials", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...draftPayload(draft) }),
      })
      const data = await res.json()
      if (!res.ok) {
        setMessage({ ok: false, text: data.error || "Failed to submit request." })
        return
      }
      setEditingId(null)
      setMessage({ ok: true, text: "Change request submitted for review." })
      await refreshRequests()
    } finally {
      setBusy(false)
    }
  }

  async function remove(id: string) {
    setBusy(true)
    setMessage(null)
    try {
      const res = await fetch(`/api/creator/profile/socials?id=${id}`, { method: "DELETE" })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setMessage({ ok: true, text: "Removal request submitted for review." })
        await refreshRequests()
      } else {
        setMessage({ ok: false, text: data.error || "Failed to submit request." })
      }
    } finally {
      setBusy(false)
    }
  }

  async function cancelRequest(requestId: string) {
    setBusy(true)
    try {
      const res = await fetch(`/api/creator/profile/socials?request=${requestId}`, { method: "DELETE" })
      if (res.ok) setRequests((rs) => rs.filter((r) => r.id !== requestId))
    } finally {
      setBusy(false)
    }
  }

  async function setPrimary(id: string) {
    setBusy(true)
    try {
      const res = await fetch("/api/creator/profile/socials", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, isPrimary: true }),
      })
      if (res.ok) setRows((r) => r.map((x) => ({ ...x, isPrimary: x.id === id })))
    } finally {
      setBusy(false)
    }
  }

  function draftFields() {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium mb-1">Platform</label>
            <select className={inputCls} value={draft.platform} onChange={(e) => setDraft({ ...draft, platform: e.target.value })}>
              {PLATFORMS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Profile URL</label>
            <input className={inputCls} placeholder="https://…" value={draft.profileUrl} onChange={(e) => setDraft({ ...draft, profileUrl: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Username / handle</label>
            <input className={inputCls} placeholder="@yourhandle" value={draft.username} onChange={(e) => setDraft({ ...draft, username: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Followers</label>
            <input className={inputCls} type="number" min={0} value={draft.followers} onChange={(e) => setDraft({ ...draft, followers: e.target.value })} />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Reason for change <span className="text-muted-foreground">(optional)</span></label>
          <input className={inputCls} placeholder="e.g. New handle after rebrand" value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} />
        </div>
      </div>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium">Social Profiles</CardTitle>
        {!adding && (
          <Button size="sm" variant="outline" onClick={() => { setAdding(true); setEditingId(null); setDraft({ ...emptyDraft }) }}>
            <Plus className="w-4 h-4 mr-1" /> Add
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          These are the accounts you publish on. MartPoint uses them to verify your content and score challenges, so changes go to the team for a quick review — you&apos;ll be notified when it&apos;s approved.
        </p>

        {rows.length === 0 && !adding && (
          <p className="text-sm text-muted-foreground">No social profiles yet — request the platforms you post on.</p>
        )}

        {rows.map((s) => (
          <div key={s.id} className="rounded-lg border p-3 text-sm space-y-3">
            {editingId === s.id ? (
              <>
                {draftFields()}
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => saveEdit(s.id)} disabled={busy}>
                    {busy ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Check className="w-4 h-4 mr-1" />} Submit for review
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}><X className="w-4 h-4 mr-1" /> Cancel</Button>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium flex items-center gap-2">
                    {platformLabel(s.platform)}{s.username ? ` · ${s.username}` : ""}
                    {s.isPrimary && <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-retail"><Star className="w-3 h-3 fill-retail" /> Primary</span>}
                  </p>
                  <a href={s.profileUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-retail hover:underline break-all">{s.profileUrl}</a>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {s.followers != null && <span className="text-xs text-muted-foreground mr-2">{s.followers.toLocaleString()} followers</span>}
                  {!s.isPrimary && (
                    <Button size="icon" variant="ghost" className="h-7 w-7" title="Set as primary" onClick={() => setPrimary(s.id)} disabled={busy}>
                      <Star className="w-3.5 h-3.5" />
                    </Button>
                  )}
                  <Button
                    size="icon" variant="ghost" className="h-7 w-7" title="Request change"
                    onClick={() => {
                      setEditingId(s.id)
                      setAdding(false)
                      setDraft({ platform: s.platform, profileUrl: s.profileUrl, username: s.username || "", followers: s.followers != null ? String(s.followers) : "", note: "" })
                    }}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500" title="Request removal" onClick={() => remove(s.id)} disabled={busy}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}

        {adding && (
          <div className="rounded-lg border border-dashed p-3 space-y-3">
            {draftFields()}
            <div className="flex gap-2">
              <Button size="sm" onClick={addRow} disabled={busy || !draft.profileUrl.trim()}>
                {busy ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Plus className="w-4 h-4 mr-1" />} Submit for review
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
            </div>
          </div>
        )}

        {requests.length > 0 && (
          <div className="pt-1 space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Change requests</p>
            {requests.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium flex items-center gap-2">
                    {requestTypeLabel[r.requestType] || r.requestType}
                    {r.payload.platform ? ` · ${platformLabel(r.payload.platform)}` : ""}
                    {r.status === "PENDING" && <Clock className="w-3.5 h-3.5 text-amber-500" />}
                  </p>
                  {r.payload.profileUrl && <p className="text-xs text-muted-foreground break-all">{r.payload.profileUrl}</p>}
                  {r.status === "REJECTED" && r.reviewNote && <p className="text-xs text-red-500">{r.reviewNote}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-xs font-medium ${
                    r.status === "PENDING" ? "text-amber-600" :
                    r.status === "APPROVED" ? "text-green-600" :
                    "text-muted-foreground"
                  }`}>
                    {r.status === "PENDING" ? "In review" : r.status === "APPROVED" ? "Approved" : r.status === "REJECTED" ? "Declined" : "Cancelled"}
                  </span>
                  {r.status === "PENDING" && (
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => cancelRequest(r.id)} disabled={busy}>
                      Cancel
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {message && <p className={`text-sm ${message.ok ? "text-green-600" : "text-red-500"}`}>{message.text}</p>}
      </CardContent>
    </Card>
  )
}
