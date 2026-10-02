"use client"

import { useEffect, useRef, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, Megaphone } from "lucide-react"

interface Meta {
  totalCreators: number
  readyCreators: number
  challenges: { id: string; title: string; status: string }[]
}

const inputCls = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm"

export function BroadcastCard() {
  const [meta, setMeta] = useState<Meta | null>(null)
  const [audience, setAudience] = useState("ALL")
  const [challengeId, setChallengeId] = useState("")
  const [form, setForm] = useState({ title: "", body: "", link: "" })
  const [sendEmail, setSendEmail] = useState(false)
  const [busy, setBusy] = useState(false)
  const inFlight = useRef(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    fetch("/api/admin/creators/broadcast")
      .then((r) => r.json())
      .then(setMeta)
      .catch(() => {})
  }, [])

  async function send() {
    if (inFlight.current) return // synchronous guard against double-click before `busy` re-renders
    inFlight.current = true
    setBusy(true)
    setMessage(null)
    try {
      const res = await fetch("/api/admin/creators/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audience,
          challengeId: audience === "CHALLENGE" ? challengeId : undefined,
          title: form.title,
          body: form.body,
          link: form.link || undefined,
          sendEmail,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setMessage({ ok: false, text: data.error || "Failed to send." })
        return
      }
      setMessage({ ok: true, text: `Sent to ${data.recipients} creator${data.recipients === 1 ? "" : "s"}${data.emailsSent ? ` · ${data.emailsSent} emails` : ""}.` })
      setForm({ title: "", body: "", link: "" })
    } finally {
      inFlight.current = false
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Megaphone className="w-4 h-4" /> Announce to creators</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Sends an in-portal notification to the selected audience — optionally as an email too.
          For a single creator, use the creator&apos;s profile page instead.
        </p>
        <div>
          <label className="block text-xs font-medium mb-1">Audience</label>
          <select className={inputCls} value={audience} onChange={(e) => setAudience(e.target.value)}>
            <option value="ALL">All creators ({meta?.totalCreators ?? "…"})</option>
            <option value="READY">Creator Ready only ({meta?.readyCreators ?? "…"})</option>
            <option value="CHALLENGE">Challenge participants</option>
          </select>
        </div>
        {audience === "CHALLENGE" && (
          <div>
            <label className="block text-xs font-medium mb-1">Challenge</label>
            <select className={inputCls} value={challengeId} onChange={(e) => setChallengeId(e.target.value)}>
              <option value="">Select a challenge…</option>
              {(meta?.challenges || []).map((c) => (
                <option key={c.id} value={c.id}>{c.title} ({c.status})</option>
              ))}
            </select>
            {!meta?.challenges?.length && (
              <p className="text-xs text-muted-foreground mt-1">No challenges yet — participants audiences will be empty until Phase 3 challenges exist.</p>
            )}
          </div>
        )}
        <div>
          <label className="block text-xs font-medium mb-1">Title</label>
          <input className={inputCls} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={200} />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Message</label>
          <textarea className={inputCls} rows={3} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} maxLength={2000} />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Link (optional)</label>
          <input className={inputCls} placeholder="/creator/learn or https://…" value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="h-4 w-4" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} />
          Also send as email
        </label>
        <div className="flex items-center gap-3">
          <Button size="sm" onClick={send} disabled={busy || !form.title.trim() || !form.body.trim() || (audience === "CHALLENGE" && !challengeId)}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null} Send announcement
          </Button>
          {message && <p className={`text-sm ${message.ok ? "text-green-600" : "text-red-500"}`}>{message.text}</p>}
        </div>
      </CardContent>
    </Card>
  )
}
