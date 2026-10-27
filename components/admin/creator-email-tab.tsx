"use client"

import { useEffect, useState } from "react"
import { Eye, Loader2, Mail, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface CreatorEmail {
  id: string
  direction: "inbound" | "outbound"
  fromEmail: string | null
  toEmail: string | null
  subject: string
  bodyText: string
  status: string
  sentByName: string | null
  createdAt: string
}

const inputCls = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm"

export function CreatorEmailTab({ applicationId, name, email }: { applicationId: string; name: string; email: string }) {
  const [messages, setMessages] = useState<CreatorEmail[]>([])
  const [loading, setLoading] = useState(true)
  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")
  const [busy, setBusy] = useState<"send" | "preview" | null>(null)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [preview, setPreview] = useState("")

  useEffect(() => {
    let cancelled = false
    fetch(`/api/admin/creators/applications/${applicationId}/emails`)
      .then(async (response) => {
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || "Could not load email history")
        if (!cancelled) setMessages(data.emails || [])
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Could not load email history")
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [applicationId])

  async function send() {
    setBusy("send"); setError(""); setNotice("")
    try {
      const response = await fetch(`/api/admin/creators/applications/${applicationId}/emails`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, body }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Email could not be sent")
      setMessages((current) => [...current, data.email])
      setSubject(""); setBody("")
      if (data.warning) setError(data.warning)
      else setNotice(`Email sent to ${email}. Reply-To is creators@martpoint.com.ng.`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Email could not be sent")
    } finally {
      setBusy(null)
    }
  }

  async function showPreview() {
    setBusy("preview"); setError("")
    try {
      const response = await fetch(`/api/admin/creators/applications/${applicationId}/emails/preview`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Preview could not be rendered")
      setPreview(data.html)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Preview could not be rendered")
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Mail className="h-4 w-4" />Email {name}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm"><span className="text-muted-foreground">To:</span> {email}</div>
          <p className="text-xs text-muted-foreground">This is a normal email, separate from Additional Questions. Your email signature and the MartPoint banner are added automatically. Reply-To is creators@martpoint.com.ng; replies are filed here when that mailbox is connected to the email sync.</p>
          <div>
            <label className="mb-1 block text-xs font-medium">Subject</label>
            <input className={inputCls} value={subject} onChange={(event) => setSubject(event.target.value)} maxLength={500} placeholder="Email subject" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">Message</label>
            <textarea className={`${inputCls} min-h-48 resize-y`} value={body} onChange={(event) => setBody(event.target.value)} maxLength={20000} placeholder={`Hi ${name},\n\nWrite your message here…`} />
            <p className="mt-1 text-right text-[11px] text-muted-foreground">Simple email text · {body.length}/20,000</p>
          </div>
          {error && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          {notice && <p role="status" className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">{notice}</p>}
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={showPreview} disabled={!!busy || !body.trim()}>
              {busy === "preview" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Eye className="mr-2 h-4 w-4" />}Preview
            </Button>
            <Button onClick={send} disabled={!!busy || !subject.trim() || !body.trim() || !email}>
              {busy === "send" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}Send email
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Email history</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {loading ? <div className="flex justify-center py-5"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div> : messages.length === 0 ? (
            <p className="text-sm text-muted-foreground">No emails recorded for this application yet.</p>
          ) : messages.map((message) => (
            <article key={message.id} className="rounded-lg border p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{message.subject}</p>
                  <p className="text-xs text-muted-foreground">{message.direction === "outbound" ? `Sent by ${message.sentByName || "MartPoint"}` : `From ${message.fromEmail || "creator"}`} · {new Date(message.createdAt).toLocaleString("en-GB")}</p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[11px] ${message.status === "failed" ? "bg-red-100 text-red-700" : "bg-muted text-muted-foreground"}`}>
                  {message.direction === "inbound" ? "Received" : message.status === "sent" ? "Sent" : "Failed"}
                </span>
              </div>
              <p className="mt-3 whitespace-pre-wrap break-words text-sm text-muted-foreground">{message.bodyText}</p>
            </article>
          ))}
        </CardContent>
      </Card>

      {preview && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-3 sm:p-6" role="dialog" aria-modal="true" aria-label="Email preview">
        <div className="flex h-[min(92vh,900px)] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-background shadow-xl">
          <div className="flex items-center justify-between border-b px-4 py-3"><p className="font-semibold">Email preview</p><Button variant="outline" size="sm" onClick={() => setPreview("")}>Close</Button></div>
          <iframe title="Creator email preview" sandbox="" srcDoc={preview} className="min-h-0 flex-1 border-0 bg-white" />
        </div>
      </div>}
    </div>
  )
}
