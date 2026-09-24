"use client"

import { useEffect, useRef, useState } from "react"
import { Mail, Paperclip, Send, X } from "lucide-react"

interface HandoverPrefill {
  businessName: string
  contactName: string
  recipient: string
  softwareUrl: string
  adminUsername: string
  supportContact: string
  lastSentAt: string | null
  lastRecipients: string | null
}

interface AttachmentFile {
  name: string
  content: string
  size: number
}

const MAX_FILE_BYTES = 4 * 1024 * 1024
const MAX_TOTAL_BYTES = 10 * 1024 * 1024

export function HandoverPanel({ businessId }: { businessId: string }) {
  const [prefill, setPrefill] = useState<HandoverPrefill | null>(null)
  const [recipients, setRecipients] = useState("")
  const [softwareUrl, setSoftwareUrl] = useState("")
  const [adminUsername, setAdminUsername] = useState("")
  const [tempPassword, setTempPassword] = useState("")
  const [supportContact, setSupportContact] = useState("")
  const [message, setMessage] = useState("")
  const [files, setFiles] = useState<AttachmentFile[]>([])
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null)
  const [loadError, setLoadError] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch(`/api/partner/customers/${businessId}/handover`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: HandoverPrefill) => {
        setPrefill(data)
        setRecipients(data.lastRecipients || data.recipient || "")
        setSoftwareUrl(data.softwareUrl || "")
        setAdminUsername(data.adminUsername || "")
        setSupportContact(data.supportContact || "")
      })
      .catch(() => setLoadError(true))
  }, [businessId])

  function addFiles(list: FileList | null) {
    if (!list) return
    for (const file of Array.from(list)) {
      if (file.size > MAX_FILE_BYTES) {
        setResult({ ok: false, text: `"${file.name}" is over the 4 MB per-file limit` })
        continue
      }
      const reader = new FileReader()
      reader.onload = () => {
        const dataUrl = String(reader.result || "")
        const content = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl
        setFiles((prev) => {
          if (prev.length >= 10) {
            setResult({ ok: false, text: "Maximum 10 attachments" })
            return prev
          }
          const total = prev.reduce((s, f) => s + f.size, 0)
          if (total + file.size > MAX_TOTAL_BYTES) {
            setResult({ ok: false, text: "Attachments exceed the 10 MB total limit" })
            return prev
          }
          return [...prev, { name: file.name, content, size: file.size }]
        })
      }
      reader.readAsDataURL(file)
    }
  }

  async function send() {
    if (!recipients.trim() || !softwareUrl.trim() || !adminUsername.trim() || !tempPassword.trim()) {
      setResult({ ok: false, text: "Recipient, store URL, username and password are required" })
      return
    }
    setSending(true)
    setResult(null)
    try {
      const res = await fetch(`/api/partner/customers/${businessId}/handover`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipients: recipients.trim(),
          softwareUrl: softwareUrl.trim(),
          adminUsername: adminUsername.trim(),
          tempPassword,
          message: message.trim() || undefined,
          supportContact: supportContact.trim() || undefined,
          attachments: files.filter((f) => f.content).map((f) => ({ name: f.name, content: f.content })),
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setResult({ ok: true, text: `Handover email sent to ${recipients.trim()}` })
        setPrefill((p) => (p ? { ...p, lastSentAt: new Date().toISOString(), lastRecipients: recipients.trim() } : p))
      } else {
        setResult({ ok: false, text: data.error || "Failed to send handover email" })
      }
    } catch {
      setResult({ ok: false, text: "Failed to send handover email" })
    } finally {
      setSending(false)
    }
  }

  if (loadError) return null
  if (!prefill) return <p className="text-sm text-muted-foreground">Loading handover details…</p>

  const inputCls = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm"

  return (
    <div className="rounded-lg border border-border p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Mail className="h-5 w-5 text-retail" />
        <div>
          <h3 className="font-semibold">Installation Handover Email</h3>
          <p className="text-xs text-muted-foreground">
            Send {prefill.businessName} their store URL and the login created during installation.
            Attach an installation guide if needed.
          </p>
        </div>
      </div>

      {prefill.lastSentAt && (
        <p className="text-xs text-muted-foreground">
          Last sent to {prefill.lastRecipients} on {new Date(prefill.lastSentAt).toLocaleString()}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium">Send to</label>
          <input className={inputCls} type="email" value={recipients} onChange={(e) => setRecipients(e.target.value)} placeholder="client@business.com" />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium">Store / Login URL *</label>
          <input className={inputCls} type="url" value={softwareUrl} onChange={(e) => setSoftwareUrl(e.target.value)} placeholder="https://store.martpoint.com.ng/admin" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium">Admin Username/Email *</label>
          <input className={inputCls} value={adminUsername} onChange={(e) => setAdminUsername(e.target.value)} placeholder="Login created during installation" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium">Temporary Password *</label>
          <input className={inputCls} value={tempPassword} onChange={(e) => setTempPassword(e.target.value)} placeholder="Client will be asked to change it" />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium">Support contact (optional)</label>
          <input className={inputCls} value={supportContact} onChange={(e) => setSupportContact(e.target.value)} placeholder="e.g. your support email or phone" />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium">Personal note (optional — added to the email)</label>
          <textarea className={inputCls} rows={3} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Anything the client should know about their new store…" />
        </div>
      </div>

      <div>
        <input ref={fileInput} type="file" multiple className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = "" }} />
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
        >
          <Paperclip className="h-4 w-4" /> Attach installation guide
        </button>
        <p className="mt-1 text-[11px] text-muted-foreground">PDF or images — up to 10 files, 4 MB each, 10 MB total.</p>
        {files.length > 0 && (
          <ul className="mt-2 space-y-1">
            {files.map((f, i) => (
              <li key={`${f.name}-${i}`} className="flex items-center gap-2 text-sm">
                <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="truncate">{f.name}</span>
                <button type="button" onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive">
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {result && (
        <p className={`text-sm ${result.ok ? "text-green-600" : "text-destructive"}`}>{result.text}</p>
      )}

      <button
        onClick={send}
        disabled={sending}
        className="inline-flex items-center gap-2 rounded-md bg-retail px-4 py-2 text-sm font-medium text-white hover:bg-retail/90 disabled:opacity-60"
      >
        <Send className="h-4 w-4" />
        {sending ? "Sending…" : prefill.lastSentAt ? "Resend Handover Email" : "Send Handover Email"}
      </button>
    </div>
  )
}
