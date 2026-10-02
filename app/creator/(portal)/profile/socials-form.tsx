"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, Plus, Pencil, Trash2, Star, Check, X } from "lucide-react"

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

interface Draft {
  platform: string
  profileUrl: string
  username: string
  followers: string
}

const emptyDraft: Draft = { platform: "TIKTOK", profileUrl: "", username: "", followers: "" }

export function SocialsManager({ initial }: { initial: SocialRow[] }) {
  const [rows, setRows] = useState<SocialRow[]>(initial)
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft>({ ...emptyDraft })
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  function draftPayload(d: Draft) {
    return {
      platform: d.platform,
      profileUrl: d.profileUrl.trim(),
      username: d.username.trim() || null,
      followers: d.followers ? Number(d.followers) : null,
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
        setMessage({ ok: false, text: data.error || "Failed to add profile." })
        return
      }
      setRows((r) => [...r, { id: data.id, isPrimary: false, ...draftPayload(draft) } as SocialRow])
      setDraft({ ...emptyDraft })
      setAdding(false)
      setMessage({ ok: true, text: "Profile added." })
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
        setMessage({ ok: false, text: data.error || "Failed to update profile." })
        return
      }
      setRows((r) => r.map((x) => (x.id === id ? { ...x, ...draftPayload(draft) } : x)))
      setEditingId(null)
      setMessage({ ok: true, text: "Profile updated." })
    } finally {
      setBusy(false)
    }
  }

  async function remove(id: string) {
    setBusy(true)
    setMessage(null)
    try {
      const res = await fetch(`/api/creator/profile/socials?id=${id}`, { method: "DELETE" })
      if (res.ok) setRows((r) => r.filter((x) => x.id !== id))
      else setMessage({ ok: false, text: "Failed to remove profile." })
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
          These are the accounts you publish on. Keep them current — MartPoint uses them to verify your content and credit your work.
        </p>

        {rows.length === 0 && !adding && (
          <p className="text-sm text-muted-foreground">No social profiles yet — add the platforms you post on.</p>
        )}

        {rows.map((s) => (
          <div key={s.id} className="rounded-lg border p-3 text-sm space-y-3">
            {editingId === s.id ? (
              <>
                {draftFields()}
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => saveEdit(s.id)} disabled={busy}>
                    {busy ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Check className="w-4 h-4 mr-1" />} Save
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
                    size="icon" variant="ghost" className="h-7 w-7" title="Edit"
                    onClick={() => {
                      setEditingId(s.id)
                      setAdding(false)
                      setDraft({ platform: s.platform, profileUrl: s.profileUrl, username: s.username || "", followers: s.followers != null ? String(s.followers) : "" })
                    }}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500" title="Remove" onClick={() => remove(s.id)} disabled={busy}>
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
                {busy ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Plus className="w-4 h-4 mr-1" />} Add profile
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
            </div>
          </div>
        )}

        {message && <p className={`text-sm ${message.ok ? "text-green-600" : "text-red-500"}`}>{message.text}</p>}
      </CardContent>
    </Card>
  )
}
