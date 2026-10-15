"use client"

import { useCallback, useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, MessageSquareQuote, Plus, Sparkles, Trash2, Paperclip, Send } from "lucide-react"

interface DraftField {
  key: string
  name: string
  label: string
  type: string
  required: boolean
  options: string
}

interface Attachment { name?: string; size?: number; mime?: string; url?: string | null }

interface RoundField { name: string; label: string; type: string; required?: boolean; helpText?: string; options?: string[] }

interface Round {
  id: string
  title: string
  status: "Sent" | "Submitted" | "Reviewed"
  fields: RoundField[]
  responses: Record<string, unknown>
  sent_at: string | null
  submitted_at: string | null
  reviewed_at: string | null
}

interface SamplePack { key: string; title: string; description: string; fields: RoundField[] }

const inputCls = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
const FIELD_TYPES: { value: string; label: string }[] = [
  { value: "text", label: "Short text" },
  { value: "textarea", label: "Long answer" },
  { value: "boolean", label: "Yes / No" },
  { value: "select", label: "Dropdown" },
  { value: "multiselect", label: "Multiple choice" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "file", label: "File upload" },
]

const STATUS_BADGE: Record<string, string> = {
  Sent: "bg-blue-50 text-blue-700",
  Submitted: "bg-amber-50 text-amber-700",
  Reviewed: "bg-green-50 text-green-700",
}

function newDraftField(): DraftField {
  return { key: `d${Date.now()}${Math.random().toString(36).slice(2, 6)}`, name: "", label: "", type: "textarea", required: true, options: "" }
}

function packToDraft(fields: RoundField[]): DraftField[] {
  return fields.map((f) => ({
    key: `p${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
    name: f.name, label: f.label, type: f.type, required: !!f.required, options: (f.options || []).join(", "),
  }))
}

export function CreatorQuestionRoundsPanel({ applicationId, onSent }: { applicationId: string; onSent?: () => void }) {
  const [loading, setLoading] = useState(true)
  const [rounds, setRounds] = useState<Round[]>([])
  const [samplePacks, setSamplePacks] = useState<SamplePack[]>([])
  const [composing, setComposing] = useState(false)
  const [title, setTitle] = useState("Additional Questions")
  const [draftFields, setDraftFields] = useState<DraftField[]>([newDraftField()])
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState("")

  const load = useCallback(() => {
    return fetch(`/api/admin/creators/applications/${applicationId}/questions`)
      .then((r) => r.json())
      .then((d) => {
        setRounds(d.rounds || [])
        setSamplePacks(d.samplePacks || [])
      })
      .finally(() => setLoading(false))
  }, [applicationId])

  useEffect(() => { void load() }, [load])

  const flash = (text: string) => { setMessage(text); setTimeout(() => setMessage(""), 6000) }

  async function generateFromAi() {
    setBusy("generate")
    try {
      const res = await fetch(`/api/admin/creators/applications/${applicationId}/questions/generate`, { method: "POST" })
      const d = await res.json()
      if (!res.ok) { flash(d.error || "Could not generate questions"); return }
      setTitle(d.title || "Pre-Interview Questions")
      setDraftFields(packToDraft(d.fields as RoundField[]))
      setComposing(true)
      flash("Draft questions loaded from the AI assessment — edit or send as-is.")
    } finally {
      setBusy(null)
    }
  }

  async function send() {
    const fields = draftFields
      .filter((f) => f.label.trim())
      .map((f, i) => ({
        name: f.name || `q_${i + 1}_${Date.now().toString(36)}`,
        label: f.label.trim(),
        type: f.type,
        required: f.required,
        ...(f.type === "file" ? { helpText: "PDF, PNG, JPEG or WEBP · up to 5 MB each" } : {}),
        ...(["select", "multiselect"].includes(f.type) && f.options.trim()
          ? { options: f.options.split(",").map((o) => o.trim()).filter(Boolean) } : {}),
      }))
    if (!fields.length) { flash("Add at least one question with text."); return }
    setBusy("send")
    try {
      const res = await fetch(`/api/admin/creators/applications/${applicationId}/questions`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, fields }),
      })
      const d = await res.json()
      if (!res.ok) { flash(d.error || "Could not send questions"); return }
      setComposing(false)
      setDraftFields([newDraftField()])
      flash(d.emailSent ? "Questions emailed to the applicant · application set to Manual Review." : "Questions saved, but the email failed to send.")
      await load()
      onSent?.()
    } finally {
      setBusy(null)
    }
  }

  async function markReviewed(roundId: string) {
    setBusy(roundId)
    try {
      const res = await fetch(`/api/admin/creators/applications/${applicationId}/questions`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ roundId }),
      })
      const d = await res.json()
      flash(res.ok ? "Responses marked reviewed." : d.error || "Could not mark reviewed")
      if (res.ok) await load()
    } finally {
      setBusy(null)
    }
  }

  const renderAnswer = (field: RoundField, answer: unknown) => {
    if (field.type === "file") {
      const items = Array.isArray(answer) ? answer as Attachment[] : []
      if (!items.length) return <p className="text-xs text-muted-foreground italic">No files attached</p>
      return (
        <ul className="space-y-1">
          {items.map((a, i) => a.url ? (
            <li key={i}>
              <a href={a.url} target="_blank" rel="noopener noreferrer" className="text-xs text-retail hover:underline inline-flex items-center gap-1">
                <Paperclip className="w-3 h-3" /> {a.name} {a.size ? `(${a.size >= 1048576 ? `${(a.size / 1048576).toFixed(1)} MB` : `${Math.round(a.size / 1024)} KB`})` : ""}
              </a>
            </li>
          ) : <li key={i} className="text-xs text-muted-foreground">{a.name} — link expired, reopen this card</li>)}
        </ul>
      )
    }
    if (Array.isArray(answer)) return <p className="text-sm">{answer.map(String).join(", ")}</p>
    return <p className="text-sm whitespace-pre-wrap">{String(answer ?? "—")}</p>
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center justify-between">
          <span className="flex items-center gap-2"><MessageSquareQuote className="w-4 h-4 text-retail" /> Additional Questions</span>
          {!composing && (
            <Button size="sm" variant="outline" onClick={() => { setComposing(true); setTitle("Additional Questions"); setDraftFields([newDraftField()]) }}>
              <Plus className="w-3.5 h-3.5 mr-1" /> Ask
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading && <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>}
        {!loading && message && <p className="rounded-md bg-muted px-3 py-2 text-xs">{message}</p>}

        {!loading && rounds.length === 0 && !composing && (
          <p className="text-sm text-muted-foreground">No questions sent yet. Ask follow-ups before the interview — applicants can attach screenshots and documents.</p>
        )}

        {rounds.map((round) => (
          <div key={round.id} className="rounded-lg border p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium">{round.title}</p>
              <span className={`text-[11px] font-semibold rounded-full px-2 py-0.5 ${STATUS_BADGE[round.status] || "bg-muted"}`}>{round.status}</span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Sent {round.sent_at ? new Date(round.sent_at).toLocaleString("en-GB") : "—"}
              {round.submitted_at ? ` · answered ${new Date(round.submitted_at).toLocaleString("en-GB")}` : ""}
              {round.reviewed_at ? ` · reviewed ${new Date(round.reviewed_at).toLocaleString("en-GB")}` : ""}
            </p>
            {round.status !== "Sent" && (
              <div className="space-y-2.5 border-t pt-2">
                {round.fields.map((field) => (
                  <div key={field.name}>
                    <p className="text-xs font-medium text-muted-foreground">{field.label}</p>
                    {renderAnswer(field, round.responses?.[field.name])}
                  </div>
                ))}
              </div>
            )}
            {round.status === "Submitted" && (
              <Button size="sm" variant="outline" disabled={!!busy} onClick={() => markReviewed(round.id)}>
                {busy === round.id ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null} Mark Reviewed
              </Button>
            )}
          </div>
        ))}

        {composing && (
          <div className="rounded-lg border p-3 space-y-3">
            <p className="text-xs font-semibold uppercase text-muted-foreground">New question round</p>
            <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Round title" />
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" disabled={!!busy} onClick={generateFromAi}>
                {busy === "generate" ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Sparkles className="w-3.5 h-3.5 mr-1" />} Generate from AI assessment
              </Button>
              {samplePacks.map((pack) => (
                <Button key={pack.key} size="sm" variant="outline" title={pack.description} onClick={() => { setTitle(pack.title); setDraftFields(packToDraft(pack.fields)) }}>
                  <Plus className="w-3.5 h-3.5 mr-1" /> {pack.title}
                </Button>
              ))}
            </div>
            <div className="space-y-2">
              {draftFields.map((f, i) => (
                <div key={f.key} className="space-y-1.5 rounded-md bg-muted/40 p-2">
                  <div className="flex gap-2">
                    <input className={`${inputCls} flex-1`} value={f.label} onChange={(e) => setDraftFields((c) => c.map((d) => d.key === f.key ? { ...d, label: e.target.value } : d))} placeholder={`Question ${i + 1}`} />
                    <select className="rounded-md border border-input bg-background px-2 py-2 text-xs shrink-0" value={f.type} onChange={(e) => setDraftFields((c) => c.map((d) => d.key === f.key ? { ...d, type: e.target.value } : d))}>
                      {FIELD_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                    <Button size="sm" variant="ghost" aria-label="Remove question" onClick={() => setDraftFields((c) => c.filter((d) => d.key !== f.key))}>
                      <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                      <input type="checkbox" checked={f.required} onChange={(e) => setDraftFields((c) => c.map((d) => d.key === f.key ? { ...d, required: e.target.checked } : d))} className="rounded border-input" /> Required
                    </label>
                    {["select", "multiselect"].includes(f.type) && (
                      <input className={`${inputCls} text-xs`} value={f.options} onChange={(e) => setDraftFields((c) => c.map((d) => d.key === f.key ? { ...d, options: e.target.value } : d))} placeholder="Options, comma separated" />
                    )}
                    {f.type === "file" && <span className="text-[11px] text-muted-foreground">Applicant uploads PDF/PNG/JPEG/WEBP · 5 MB each</span>}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setDraftFields((c) => [...c, newDraftField()])}><Plus className="w-3.5 h-3.5 mr-1" /> Add question</Button>
              <Button size="sm" variant="ghost" onClick={() => setComposing(false)}>Cancel</Button>
              <Button size="sm" className="ml-auto" disabled={!!busy} onClick={send}>
                {busy === "send" ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Send className="w-3.5 h-3.5 mr-1" />} Send to applicant
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">Sending emails the applicant a private answer link and moves the application to Manual Review until answers arrive.</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
