"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { ChevronDown, Eye, Loader2, Mail, RefreshCw, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import EmailRichEditor from "@/components/admin/email-rich-editor"
import { htmlToText } from "@/lib/email-html"
import type { PartnerEmailRecipient } from "@/lib/partner-email"

interface PartnerEmail {
  id: string
  direction: string
  fromEmail: string
  toEmail: string
  subject: string
  bodyText: string
  status: string
  sentByName: string | null
  error: string | null
  createdAt: string
}
const inputCls = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
const statusLabels: Record<string, string> = {
  pending: "Sending / awaiting confirmation",
  accepted: "Accepted by email provider",
  failed: "Failed",
  received: "Received"
}

export function PartnerEmailTab({ partnerId, name }: { partnerId: string; name: string }) {
  const [messages, setMessages] = useState<PartnerEmail[]>([])
  const [recipients, setRecipients] = useState<PartnerEmailRecipient[]>([])
  const [recipient, setRecipient] = useState("")
  const [recipientOpen, setRecipientOpen] = useState(false)
  const [canSend, setCanSend] = useState(false)
  const [loading, setLoading] = useState(true)
  const [historyReady, setHistoryReady] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [subject, setSubject] = useState("")
  const [bodyHtml, setBodyHtml] = useState("")
  const [busy, setBusy] = useState<"send" | "preview" | null>(null)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [preview, setPreview] = useState("")
  const [search, setSearch] = useState("")
  const attempt = useRef<{ content: string; id: string } | null>(null)
  const mounted = useRef(false)

  const load = useCallback(
    async (offset = 0, signal?: AbortSignal) => {
      try {
        const response = await fetch(`/api/admin/partners/${partnerId}/emails?offset=${offset}`, {
          signal,
          cache: "no-store"
        })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || "Could not load email history")
        if (signal?.aborted || !mounted.current) return
        setMessages((current) =>
          offset
            ? [
                ...current,
                ...data.emails.filter((email: PartnerEmail) => !current.some((item) => item.id === email.id))
              ]
            : data.emails
        )
        setRecipients(data.recipients || [])
        setRecipient((current) =>
          data.recipients.some((item: PartnerEmailRecipient) => item.email === current)
            ? current
            : data.recipients[0]?.email || ""
        )
        setCanSend(data.canSend)
        setHasMore(data.hasMore)
        setHistoryReady(true)
      } catch (cause) {
        if (!signal?.aborted && mounted.current)
          setError(cause instanceof Error ? cause.message : "Could not load emails")
      } finally {
        if (!signal?.aborted && mounted.current) setLoading(false)
      }
    },
    [partnerId]
  )

  useEffect(() => {
    mounted.current = true
    const controller = new AbortController()
    queueMicrotask(() => {
      if (!controller.signal.aborted) void load(0, controller.signal)
    })
    return () => {
      mounted.current = false
      controller.abort()
    }
  }, [load])

  async function send() {
    if (busy) return
    setBusy("send")
    setError("")
    setNotice("")
    const content = JSON.stringify([recipient, subject, bodyHtml])
    if (attempt.current?.content !== content) attempt.current = { content, id: crypto.randomUUID() }
    try {
      const response = await fetch(`/api/admin/partners/${partnerId}/emails`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipient, subject, bodyHtml, requestId: attempt.current.id })
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Email could not be sent")
      if (!mounted.current) return
      setMessages((current) => [data.email, ...current.filter((item) => item.id !== data.email.id)])
      if (data.sent) {
        setSubject("")
        setBodyHtml("")
        setPreview("")
        attempt.current = null
        setNotice(`Email accepted for delivery to ${recipient}.`)
      } else if (data.email.status === "failed") {
        attempt.current = null
        setError(data.warning || data.email.error || "Email failed. Your draft has been kept for retry.")
      } else {
        setNotice("This message is awaiting provider confirmation. Refresh history before trying again.")
      }
      if (data.warning) setError(data.warning)
    } catch (cause) {
      if (mounted.current) setError(cause instanceof Error ? cause.message : "Email could not be sent")
    } finally {
      if (mounted.current) setBusy(null)
    }
  }

  async function showPreview() {
    setBusy("preview")
    setError("")
    try {
      const response = await fetch(`/api/admin/partners/${partnerId}/emails/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bodyHtml })
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Preview could not be rendered")
      if (mounted.current) setPreview(data.html)
    } catch (cause) {
      if (mounted.current) setError(cause instanceof Error ? cause.message : "Preview could not be rendered")
    } finally {
      if (mounted.current) setBusy(null)
    }
  }

  const validBody = !!htmlToText(bodyHtml).trim()
  const filtered = messages.filter((email) =>
    `${email.subject} ${email.bodyText} ${email.toEmail} ${email.fromEmail}`
      .toLowerCase()
      .includes(search.toLowerCase())
  )
  return (
    <div className="space-y-6">
      {error && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
          {notice}
        </p>
      )}
      {historyReady && canSend && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Mail className="h-4 w-4" />
              Email {name}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Send a normal email, separate from compliance requests. Your personal email signature and the
              MartPoint banner are included automatically. Replies go to partners@martpoint.com.ng.
            </p>
            <div>
              <label id="partner-email-to-label" htmlFor="partner-email-to" className="mb-1 block text-sm font-medium">
                To
              </label>
              <select
                name="recipient"
                hidden
                aria-hidden="true"
                tabIndex={-1}
                value={recipient}
                onChange={(event) => setRecipient(event.target.value)}
                disabled={!!busy || !recipients.length}
              >
                {!recipients.length && <option value="">No email address saved</option>}
                {recipients.map((item) => (
                  <option key={item.email} value={item.email}>
                    {item.label} · {item.email}
                  </option>
                ))}
              </select>
              <button
                id="partner-email-to"
                type="button"
                className={`${inputCls} flex items-center justify-between gap-2 text-left`}
                aria-labelledby="partner-email-to-label partner-email-selected"
                aria-expanded={recipientOpen}
                aria-controls="partner-email-recipients"
                disabled={!!busy || !recipients.length}
                onClick={() => setRecipientOpen((open) => !open)}
              >
                <span id="partner-email-selected" className="min-w-0 break-words">
                  {recipients.find((item) => item.email === recipient)?.label}
                  {recipient ? ` · ${recipient}` : "No email address saved"}
                </span>
                <ChevronDown className="h-4 w-4 shrink-0" />
              </button>
              {recipientOpen && (
                <fieldset
                  id="partner-email-recipients"
                  aria-labelledby="partner-email-to-label"
                  className="mt-2 max-h-56 space-y-1 overflow-y-auto rounded-md border p-2"
                  disabled={!!busy}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      setRecipientOpen(false)
                      document.getElementById("partner-email-to")?.focus()
                    }
                  }}
                >
                  {recipients.map((item) => (
                    <label key={item.email} className="flex cursor-pointer items-center gap-2 rounded px-2 py-2 text-sm hover:bg-muted">
                      <input
                        type="radio"
                        name="partner-email-recipient-choice"
                        value={item.email}
                        checked={recipient === item.email}
                        onChange={() => {
                          setRecipient(item.email)
                          setPreview("")
                        }}
                      />
                      <span className="min-w-0 break-words">{item.label} · {item.email}</span>
                    </label>
                  ))}
                </fieldset>
              )}
              {!recipients.length && (
                <p className="mt-2 text-sm text-amber-700">
                  Add a contact email in Overview or invite a partner user in Users before sending.
                </p>
              )}
            </div>
            <div>
              <label htmlFor="partner-email-subject" className="mb-1 block text-sm font-medium">
                Subject
              </label>
              <input
                id="partner-email-subject"
                className={inputCls}
                maxLength={500}
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                disabled={!!busy}
                placeholder="Email subject"
              />
            </div>
            <div>
              <p className="mb-1 text-sm font-medium">Message</p>
              <fieldset
                disabled={!!busy}
                inert={!!busy}
                className={busy ? "pointer-events-none opacity-70" : ""}
              >
                <EmailRichEditor
                  value={bodyHtml}
                  onChange={(html) => {
                    setBodyHtml(html)
                    setPreview("")
                  }}
                  allowImages={false}
                  minHeight={240}
                />
              </fieldset>
              <p className="mt-2 text-xs text-muted-foreground">
                Your signature is added at send time. Use Preview to check it before sending.
              </p>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" onClick={showPreview} disabled={!!busy || !validBody}>
                {busy === "preview" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Eye className="mr-2 h-4 w-4" />
                )}
                Preview
              </Button>
              <Button
                onClick={send}
                disabled={!!busy || !recipient || !subject.trim() || !validBody || bodyHtml.length > 50000}
              >
                {busy === "send" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                Send email
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-base">Email history</CardTitle>
          <Button variant="outline" size="sm" onClick={() => { setLoading(true); setError(""); void load() }} disabled={loading || !!busy}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Newest first. Incoming replies appear here when the partners mailbox is connected to email sync or
            inbound forwarding. Provider acceptance does not confirm inbox delivery.
          </p>
          {historyReady && !canSend && (
            <p className="text-sm text-muted-foreground">
              You can view email history. Sending requires permission to manage partners.
            </p>
          )}
          <input
            aria-label="Search loaded emails"
            className={inputCls}
            placeholder="Search loaded emails"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          {loading && !messages.length ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : !filtered.length ? (
            <p className="text-sm text-muted-foreground">
              {search
                ? "No matching emails in the loaded history."
                : historyReady
                  ? "No direct emails recorded for this partner yet."
                  : "Email history is unavailable. Use Refresh to retry."}
            </p>
          ) : (
            filtered.map((email) => (
              <details key={email.id} className="rounded-lg border p-3">
                <summary className="cursor-pointer text-sm">
                  <span className="font-medium">{email.subject}</span>
                  <span
                    className={`ml-2 inline-block rounded-full px-2 py-0.5 text-xs ${email.status === "failed" ? "bg-red-50 text-red-700" : email.status === "pending" ? "bg-amber-50 text-amber-700" : "bg-muted text-muted-foreground"}`}
                  >
                    {statusLabels[email.status] || "Awaiting confirmation"}
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {email.direction === "inbound"
                      ? `From ${email.fromEmail}`
                      : `To ${email.toEmail} · ${email.sentByName || "MartPoint"}`}{" "}
                    · {new Date(email.createdAt).toLocaleString("en-GB")}
                  </span>
                </summary>
                <p className="mt-3 whitespace-pre-wrap break-words text-sm">{email.bodyText}</p>
                {email.error && <p className="mt-2 text-sm text-red-700">{email.error}</p>}
                {canSend &&
                  email.direction === "inbound" &&
                  recipients.some((item) => item.email === email.fromEmail.toLowerCase()) && (
                    <Button
                      className="mt-3"
                      variant="outline"
                      size="sm"
                      disabled={!!busy}
                      onClick={() => {
                        setRecipient(email.fromEmail.toLowerCase())
                        setSubject(/^re:/i.test(email.subject) ? email.subject : `Re: ${email.subject}`)
                        document
                          .getElementById("partner-email-subject")
                          ?.scrollIntoView({ behavior: "smooth", block: "center" })
                      }}
                    >
                      Reply
                    </Button>
                  )}
              </details>
            ))
          )}
          {hasMore && (
            <Button variant="outline" disabled={loading || !!busy} onClick={() => { setLoading(true); setError(""); void load(messages.length) }}>
              Load older emails
            </Button>
          )}
        </CardContent>
      </Card>
      {preview && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-3 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label="Partner email preview"
        >
          <div className="flex h-[min(92vh,900px)] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-background shadow-xl">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <p className="font-semibold">Email preview</p>
              <Button variant="outline" size="sm" onClick={() => setPreview("")}>
                Close
              </Button>
            </div>
            <iframe
              title="Partner email preview"
              sandbox=""
              srcDoc={preview}
              className="min-h-0 flex-1 border-0 bg-white"
            />
          </div>
        </div>
      )}
    </div>
  )
}
