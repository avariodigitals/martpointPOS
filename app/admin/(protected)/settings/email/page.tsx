"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import EmailRichEditor from "@/components/admin/email-rich-editor"
import { htmlToText, textToHtml } from "@/lib/email-html"
import { Loader2, Save, Mail, ArrowLeft, Code2 } from "lucide-react"

interface SmtpForm {
  host: string
  port: string
  secure: boolean
  user: string
  pass: string
  fromEmail: string
}

interface ImapForm {
  host: string
  port: string
  secure: boolean
  user: string
  pass: string
  mailbox: string
}

interface EmailSettingsForm {
  provider: "resend" | "brevo"
  resendApiKey: string
  brevoApiKey: string
  fromEmail: string
  notifyEmail: string
  signature: string
  signatureHtml: string
  smtp: SmtpForm
  imap: ImapForm
}

const emptySmtp: SmtpForm = { host: "", port: "465", secure: true, user: "", pass: "", fromEmail: "" }
const emptyImap: ImapForm = { host: "", port: "993", secure: true, user: "", pass: "", mailbox: "INBOX" }

export default function EmailSettingsPage() {
  const [settings, setSettings] = useState<EmailSettingsForm>({
    provider: "resend",
    resendApiKey: "",
    brevoApiKey: "",
    fromEmail: "",
    notifyEmail: "",
    signature: "",
    signatureHtml: "",
    smtp: { ...emptySmtp },
    imap: { ...emptyImap },
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")
  const [sigEditSource, setSigEditSource] = useState(false)

  useEffect(() => {
    fetch("/api/admin/settings", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (data.email) {
          const provider = data.email.provider === "brevo" ? "brevo" : "resend"
          const smtp = data.email.smtp || {}
          const imap = data.email.imap || {}
          setSettings({
            provider,
            resendApiKey: data.email.resendApiKey || "",
            brevoApiKey: data.email.brevoApiKey || "",
            fromEmail: data.email.fromEmail || "",
            notifyEmail: data.email.notifyEmail || "",
            signature: data.email.signature || "",
            // Migrate a legacy plain-text signature into the rich editor.
            signatureHtml: data.email.signatureHtml || textToHtml(data.email.signature || ""),
            smtp: {
              host: smtp.host || "",
              port: String(smtp.port || "465"),
              secure: smtp.secure !== false,
              user: smtp.user || "",
              pass: smtp.pass || "",
              fromEmail: smtp.fromEmail || "",
            },
            imap: {
              host: imap.host || "",
              port: String(imap.port || "993"),
              secure: imap.secure !== false,
              user: imap.user || "",
              pass: imap.pass || "",
              mailbox: imap.mailbox || "INBOX",
            },
          })
        }
      })
      .finally(() => setLoading(false))
  }, [])

  const uploadSignatureImage = async (file: File): Promise<string | null> => {
    try {
      const content = await new Promise<string>((resolve, reject) => {
        const r = new FileReader()
        r.onload = () => resolve(String(r.result).split(",")[1] || "")
        r.onerror = reject
        r.readAsDataURL(file)
      })
      const res = await fetch("/api/admin/marketing/images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: file.name, mimeType: file.type, content }),
      })
      const data = await res.json()
      return (data.url as string) || null
    } catch {
      return null
    }
  }

  const setSmtp = (patch: Partial<SmtpForm>) =>
    setSettings((s) => ({ ...s, smtp: { ...s.smtp, ...patch } }))
  const setImap = (patch: Partial<ImapForm>) =>
    setSettings((s) => ({ ...s, imap: { ...s.imap, ...patch } }))

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMessage("")

    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: {
            ...settings,
            // Keep the plain-text field in sync — it backs the text/plain part.
            signature: settings.signatureHtml ? htmlToText(settings.signatureHtml) : settings.signature,
            smtp: { ...settings.smtp, port: Number(settings.smtp.port) || 465 },
            imap: { ...settings.imap, port: Number(settings.imap.port) || 993 },
          },
        }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setMessage("Email settings saved successfully.")
      } else {
        setMessage(data.error || "Failed to save email settings.")
      }
    } catch {
      setMessage("Network error. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/settings" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Settings
        </Link>
        <h2 className="text-2xl font-bold tracking-tight mt-2 flex items-center gap-2">
          <Mail className="w-5 h-5" />
          Email Settings
        </h2>
        <p className="text-muted-foreground">Configure the backend mail provider and sender details.</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <form onSubmit={handleSave}>
          <Card>
            <CardHeader>
              <CardTitle>Mail Provider</CardTitle>
              <CardDescription>
                Choose which transactional email provider sends outbound mail. Switch any time — both keys can be stored and the active one is used.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Active Provider</label>
                <div className="flex gap-3">
                  <label className="flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm cursor-pointer has-[:checked]:border-retail has-[:checked]:bg-retail/10">
                    <input
                      type="radio"
                      name="provider"
                      value="resend"
                      checked={settings.provider === "resend"}
                      onChange={() => setSettings({ ...settings, provider: "resend" })}
                      className="accent-retail"
                    />
                    Resend
                  </label>
                  <label className="flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm cursor-pointer has-[:checked]:border-retail has-[:checked]:bg-retail/10">
                    <input
                      type="radio"
                      name="provider"
                      value="brevo"
                      checked={settings.provider === "brevo"}
                      onChange={() => setSettings({ ...settings, provider: "brevo" })}
                      className="accent-retail"
                    />
                    Brevo
                  </label>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Brevo is recommended when sending to custom/personal email addresses that Resend blocks.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>{settings.provider === "brevo" ? "Brevo Configuration" : "Resend Configuration"}</CardTitle>
              <CardDescription>
                These settings are stored in the database and override environment variables when present.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {settings.provider === "brevo" ? (
                <div>
                  <label className="block text-sm font-medium mb-1">Brevo API Key</label>
                  <input
                    type="password"
                    value={settings.brevoApiKey}
                    onChange={(e) => setSettings({ ...settings, brevoApiKey: e.target.value })}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    placeholder="xkeysib-xxxxxxxxxxxxxxxxxxxxxxxx"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Get your key from <a href="https://app.brevo.com/settings/keys/api" target="_blank" rel="noopener noreferrer" className="text-retail hover:underline">app.brevo.com/settings/keys/api</a>.
                    Falls back to the <code className="text-xs bg-muted px-1 py-0.5 rounded">BREVO_API_KEY</code> env variable if empty.
                  </p>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium mb-1">Resend API Key</label>
                  <input
                    type="password"
                    value={settings.resendApiKey}
                    onChange={(e) => setSettings({ ...settings, resendApiKey: e.target.value })}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    placeholder="re_xxxxxxxxxxxxxxxxxxxxxxxx"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Get your key from <a href="https://resend.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-retail hover:underline">resend.com/api-keys</a>.
                    Falls back to the <code className="text-xs bg-muted px-1 py-0.5 rounded">RESEND_API_KEY</code> env variable if empty.
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-1">From Email</label>
                <input
                  type="text"
                  value={settings.fromEmail}
                  onChange={(e) => setSettings({ ...settings, fromEmail: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="MartPoint Partners <hello@martpoint.com.ng>"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Format: <code className="text-xs bg-muted px-1 py-0.5 rounded">Display Name &lt;email@domain.com&gt;</code>.
                  {settings.provider === "brevo"
                    ? " The sender domain must be verified in Brevo."
                    : " The domain must be verified in Resend."}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Notify Email</label>
                <input
                  type="email"
                  value={settings.notifyEmail}
                  onChange={(e) => setSettings({ ...settings, notifyEmail: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="admin@martpoint.com.ng"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Receives a copy of new partner applications. Falls back to <code className="text-xs bg-muted px-1 py-0.5 rounded">NOTIFY_EMAIL</code> env variable if empty.
                </p>
              </div>

              {message && (
                <p className={`text-sm ${message.includes("success") ? "text-green-600" : "text-red-600"}`}>
                  {message}
                </p>
              )}
            </CardContent>
            <CardFooter className="border-t pt-4 flex items-center justify-between flex-wrap gap-3">
              <p className="text-xs text-muted-foreground">
                Changes take effect within 10 seconds due to caching.
              </p>
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save Email Settings
              </Button>
            </CardFooter>
          </Card>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Email Signature</CardTitle>
              <CardDescription>
                Appended under a <code className="text-xs bg-muted px-1 py-0.5 rounded">--</code> separator to emails
                sent from a lead&apos;s Email tab and meeting emails — just like a normal email signature.
                A plain-text version is generated automatically for mail clients that don&apos;t render HTML.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => setSigEditSource((v) => !v)}
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                >
                  <Code2 className="w-3 h-3" /> {sigEditSource ? "Visual editor" : "Edit HTML"}
                </button>
              </div>
              {sigEditSource ? (
                <textarea
                  rows={6}
                  value={settings.signatureHtml}
                  onChange={(e) => setSettings({ ...settings, signatureHtml: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                  placeholder={'<p><strong>Ralph</strong><br>MartPoint — <a href="mailto:sales@martpoint.com.ng">sales@martpoint.com.ng</a></p>'}
                />
              ) : (
                <EmailRichEditor
                  value={settings.signatureHtml}
                  onChange={(html) => setSettings((s) => ({ ...s, signatureHtml: html }))}
                  onUploadImage={uploadSignatureImage}
                  minHeight={120}
                />
              )}
              <p className="text-xs text-muted-foreground">
                Formatting, links and images (e.g. your logo) are preserved in the email. Leave empty for no signature.
              </p>
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Lead Thread Mailbox (SMTP + IMAP)</CardTitle>
              <CardDescription>
                When an SMTP host and user are set, emails sent from a lead&apos;s Email tab go out through this
                mailbox instead of Resend/Brevo, and replies are pulled back in over IMAP by the
                <code className="text-xs bg-muted px-1 py-0.5 rounded mx-1">/api/cron/email-sync</code>
                job — a true two-way thread on your own email. All other system email keeps using the provider above.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <p className="text-sm font-semibold">Outgoing — SMTP</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">SMTP Host</label>
                    <input
                      type="text"
                      value={settings.smtp.host}
                      onChange={(e) => setSmtp({ host: e.target.value })}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      placeholder="smtp.yourprovider.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Port</label>
                    <input
                      type="number"
                      value={settings.smtp.port}
                      onChange={(e) => setSmtp({ port: e.target.value })}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      placeholder="465"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Username</label>
                    <input
                      type="text"
                      value={settings.smtp.user}
                      onChange={(e) => setSmtp({ user: e.target.value })}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      placeholder="you@martpoint.com.ng"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Password / App Password</label>
                    <input
                      type="password"
                      value={settings.smtp.pass}
                      onChange={(e) => setSmtp({ pass: e.target.value })}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      placeholder="••••••••"
                    />
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-6">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={settings.smtp.secure}
                      onChange={(e) => setSmtp({ secure: e.target.checked })}
                      className="accent-retail"
                    />
                    SSL/TLS (port 465 — uncheck for STARTTLS on 587)
                  </label>
                  <div className="flex-1 min-w-[200px]">
                    <label className="block text-sm font-medium mb-1">From Email (optional)</label>
                    <input
                      type="text"
                      value={settings.smtp.fromEmail}
                      onChange={(e) => setSmtp({ fromEmail: e.target.value })}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      placeholder="Your Name <you@martpoint.com.ng> — defaults to username"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4 border-t border-border pt-4">
                <p className="text-sm font-semibold">Incoming — IMAP</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">IMAP Host</label>
                    <input
                      type="text"
                      value={settings.imap.host}
                      onChange={(e) => setImap({ host: e.target.value })}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      placeholder="imap.yourprovider.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Port</label>
                    <input
                      type="number"
                      value={settings.imap.port}
                      onChange={(e) => setImap({ port: e.target.value })}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      placeholder="993"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Username</label>
                    <input
                      type="text"
                      value={settings.imap.user}
                      onChange={(e) => setImap({ user: e.target.value })}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      placeholder="you@martpoint.com.ng"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Password / App Password</label>
                    <input
                      type="password"
                      value={settings.imap.pass}
                      onChange={(e) => setImap({ pass: e.target.value })}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      placeholder="••••••••"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Mailbox Folder</label>
                    <input
                      type="text"
                      value={settings.imap.mailbox}
                      onChange={(e) => setImap({ mailbox: e.target.value })}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      placeholder="INBOX"
                    />
                  </div>
                  <div className="flex items-end pb-1">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={settings.imap.secure}
                        onChange={(e) => setImap({ secure: e.target.checked })}
                        className="accent-retail"
                      />
                      SSL/TLS (port 993)
                    </label>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  New unread mail in this folder is matched to leads by sender address and added to their
                  email thread every cron run. Fetched messages are marked as read. Test it any time at
                  <code className="text-xs bg-muted px-1 py-0.5 rounded mx-1">/api/cron/email-sync?secret=…</code>.
                </p>
              </div>
            </CardContent>
            <CardFooter className="border-t pt-4 flex items-center justify-end">
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save Email Settings
              </Button>
            </CardFooter>
          </Card>
        </form>
      )}
    </div>
  )
}
