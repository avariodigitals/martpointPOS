"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Loader2,
  Megaphone,
  Send,
  Eye,
  Users,
  Mail,
  MousePointerClick,
  CheckCircle2,
  AlertCircle,
  Image as ImageIcon,
  ChevronDown,
  ChevronRight,
} from "lucide-react"

interface CampaignMetrics {
  sent: number
  failed: number
  opens: number
  openTotal: number
  clicks: number
  clickTotal: number
}

interface Campaign {
  id: string
  name: string
  subject: string
  audience: string
  provider: string
  status: string
  recipientCount: number
  createdBy: string
  createdAt: string
  sentAt: string
  metrics: CampaignMetrics
}

interface SendRow {
  id: string
  email: string
  name: string
  status: string
  error_message: string | null
  sent_at: string | null
  opened_at: string | null
  open_count: number
  clicked_at: string | null
  click_count: number
}

interface RecipientPreview {
  total: number
  deliverable: number
  suppressed: number
  preview: Array<{ email: string; name: string }>
}

const AUDIENCE_LABELS: Record<string, string> = {
  leads: "Leads",
  partner_leads: "Partner Leads",
  manual: "Pasted list",
}

export default function AdminMarketingPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState("")

  // Compose state
  const [provider, setProvider] = useState("default")
  const [audience, setAudience] = useState("leads")
  const [manualEmails, setManualEmails] = useState("")
  const [subject, setSubject] = useState("")
  const [imageUrl, setImageUrl] = useState("")
  const [html, setHtml] = useState("")
  const [showPreview, setShowPreview] = useState(false)
  const [testEmail, setTestEmail] = useState("")
  const [consent, setConsent] = useState(false)
  const [sending, setSending] = useState(false)
  const [sendingTest, setSendingTest] = useState(false)

  // Recipient preview
  const [recipientInfo, setRecipientInfo] = useState<RecipientPreview | null>(null)
  const [loadingRecipients, setLoadingRecipients] = useState(false)
  const [showRecipientList, setShowRecipientList] = useState(false)

  // Expanded campaign
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [sends, setSends] = useState<SendRow[]>([])
  const [loadingSends, setLoadingSends] = useState(false)

  const loadCampaigns = async () => {
    try {
      const res = await fetch("/api/admin/marketing")
      const data = await res.json()
      setCampaigns(data.campaigns || [])
    } catch {
      setMessage("Failed to load campaigns")
    } finally {
      setLoading(false)
    }
  }

  const loadRecipientPreview = useCallback(async () => {
    setLoadingRecipients(true)
    try {
      const params = new URLSearchParams({ audience })
      if (audience === "manual") params.set("manual", manualEmails)
      const res = await fetch(`/api/admin/marketing/recipients?${params}`)
      const data = await res.json()
      setRecipientInfo(data)
    } catch {
      setRecipientInfo(null)
    } finally {
      setLoadingRecipients(false)
    }
  }, [audience, manualEmails])

  useEffect(() => {
    const t = setTimeout(loadCampaigns, 0)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    const t = setTimeout(loadRecipientPreview, 400)
    return () => clearTimeout(t)
  }, [loadRecipientPreview])

  const stats = useMemo(() => {
    const sent = campaigns.reduce((s, c) => s + c.metrics.sent, 0)
    const opens = campaigns.reduce((s, c) => s + c.metrics.opens, 0)
    const clicks = campaigns.reduce((s, c) => s + c.metrics.clicks, 0)
    return { campaigns: campaigns.length, sent, opens, clicks }
  }, [campaigns])

  const insertImage = () => {
    const url = imageUrl.trim()
    if (!url) return
    setHtml((prev) => `${prev}${prev.endsWith("\n") || prev === "" ? "" : "\n"}<img src="${url}" alt="" style="max-width:100%;height:auto;display:block;margin:16px 0" />\n`)
    setImageUrl("")
  }

  const toggleExpand = async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null)
      return
    }
    setExpandedId(id)
    setLoadingSends(true)
    setSends([])
    try {
      const res = await fetch(`/api/admin/marketing/${id}`)
      const data = await res.json()
      setSends(data.sends || [])
    } catch {
      setMessage("Failed to load campaign detail")
    } finally {
      setLoadingSends(false)
    }
  }

  const sendTest = async () => {
    if (!testEmail || !subject || !html) return
    setSendingTest(true)
    setMessage("")
    try {
      const res = await fetch("/api/admin/marketing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, html, testEmail, provider }),
      })
      const data = await res.json()
      setMessage(data.success ? `Test email sent to ${testEmail}.` : data.error || "Test send failed")
    } catch {
      setMessage("Test send failed")
    } finally {
      setSendingTest(false)
      setTimeout(() => setMessage(""), 4000)
    }
  }

  const sendCampaign = async () => {
    if (!subject || !html || !consent) return
    if (!confirm(`Send this campaign to ${recipientInfo?.deliverable ?? "?"} recipients?`)) return
    setSending(true)
    setMessage("")
    try {
      const res = await fetch("/api/admin/marketing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: subject,
          subject,
          html,
          audience,
          provider,
          manualEmails: audience === "manual" ? manualEmails : undefined,
        }),
      })
      const data = await res.json()
      if (data.success || data.campaignId) {
        setMessage(
          `Campaign sent: ${data.sent} delivered${data.failed ? `, ${data.failed} failed` : ""}${data.skipped ? `, ${data.skipped} skipped (unsubscribed)` : ""}.`
        )
        setSubject("")
        setHtml("")
        setConsent(false)
        loadCampaigns()
      } else {
        setMessage(data.error || "Failed to send campaign")
      }
    } catch {
      setMessage("Failed to send campaign")
    } finally {
      setSending(false)
      setTimeout(() => setMessage(""), 6000)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Megaphone className="w-5 h-5" />
          Email Marketing
        </h2>
        <p className="text-muted-foreground">Announce features and send campaigns to leads and partners — with open tracking and opt-out built in.</p>
      </div>

      {message && (
        <p className={`text-sm ${message.includes("sent") || message.includes("delivered") ? "text-green-600" : "text-red-500"}`}>
          {message}
        </p>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Campaigns</p>
                <p className="text-2xl font-bold">{stats.campaigns}</p>
              </div>
              <Megaphone className="w-5 h-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Emails Sent</p>
                <p className="text-2xl font-bold">{stats.sent}</p>
              </div>
              <Mail className="w-5 h-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Opens</p>
                <p className="text-2xl font-bold text-blue-600">{stats.opens}</p>
              </div>
              <Eye className="w-5 h-5 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Clicks</p>
                <p className="text-2xl font-bold text-violet-600">{stats.clicks}</p>
              </div>
              <MousePointerClick className="w-5 h-5 text-violet-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Compose */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Send className="w-4 h-4 text-muted-foreground" />
            New Campaign
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1">Email Provider</label>
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="default">Default (from Email Settings)</option>
                <option value="resend">Resend</option>
                <option value="brevo">Brevo</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Audience</label>
              <select
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="leads">Leads</option>
                <option value="partner_leads">Partner Leads</option>
                <option value="manual">Paste emails</option>
              </select>
            </div>
          </div>

          {audience === "manual" && (
            <div>
              <label className="block text-xs font-medium mb-1">Recipients (one per line, or comma-separated — &quot;Name &lt;email&gt;&quot; works)</label>
              <textarea
                value={manualEmails}
                onChange={(e) => setManualEmails(e.target.value)}
                rows={3}
                placeholder={"jane@example.com\nJohn Doe <john@example.com>"}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none font-mono"
              />
            </div>
          )}

          {/* Recipient preview */}
          <div className="rounded-md border border-border bg-muted/10 px-3 py-2 text-sm">
            {loadingRecipients ? (
              <span className="text-muted-foreground flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Counting recipients…</span>
            ) : recipientInfo ? (
              <div>
                <span className="flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-muted-foreground" />
                  <strong>{recipientInfo.deliverable}</strong>&nbsp;will receive this
                  {recipientInfo.suppressed > 0 && (
                    <span className="text-amber-600">&nbsp;· {recipientInfo.suppressed} skipped (unsubscribed)</span>
                  )}
                </span>
                {recipientInfo.preview.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowRecipientList((v) => !v)}
                    className="text-xs text-retail hover:underline mt-1"
                  >
                    {showRecipientList ? "Hide recipients" : "Preview recipients"}
                  </button>
                )}
                {showRecipientList && (
                  <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                    {recipientInfo.preview.map((r) => (
                      <li key={r.email}>{r.name ? `${r.name} — ` : ""}{r.email}</li>
                    ))}
                    {recipientInfo.deliverable > recipientInfo.preview.length && (
                      <li>…and {recipientInfo.deliverable - recipientInfo.preview.length} more</li>
                    )}
                  </ul>
                )}
              </div>
            ) : (
              <span className="text-muted-foreground">No recipients</span>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">Subject</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="New: what's shipping in MartPoint this week"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">Insert Image (hosted URL)</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://…/banner.png"
                className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
              <Button type="button" size="sm" variant="outline" onClick={insertImage} disabled={!imageUrl.trim()}>
                <ImageIcon className="w-3.5 h-3.5 mr-1" />
                Insert
              </Button>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-medium">HTML Body</label>
              <button
                type="button"
                onClick={() => setShowPreview((v) => !v)}
                className="text-xs text-retail hover:underline flex items-center gap-1"
              >
                <Eye className="w-3 h-3" /> {showPreview ? "Hide preview" : "Preview"}
              </button>
            </div>
            <textarea
              value={html}
              onChange={(e) => setHtml(e.target.value)}
              rows={10}
              placeholder={'<h2>Hi {{firstName}},</h2>\n<p>We just shipped…</p>\n<a href="https://martpoint.com.ng/product-updates">See what\'s new</a>'}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-y font-mono"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Merge tags: {"{{name}}"}, {"{{firstName}}"}, {"{{email}}"}. Links are automatically click-tracked, and an unsubscribe footer is added to every email.
            </p>
          </div>

          {showPreview && html && (
            <div className="rounded-md border border-border bg-white p-4">
              <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wider">Preview (approximate)</p>
              <div dangerouslySetInnerHTML={{ __html: html }} />
            </div>
          )}

          <label className="flex items-start gap-2 text-sm rounded-md border border-border bg-muted/10 p-3">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-0.5 rounded border-input"
            />
            <span>
              I confirm these recipients consented to receive MartPoint marketing emails. Anyone who previously unsubscribed will be skipped automatically.
            </span>
          </label>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-2">
              <input
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="test@you.com"
                className="rounded-md border border-input bg-background px-3 py-2 text-sm w-48"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={sendTest}
                disabled={sendingTest || !testEmail || !subject || !html}
              >
                {sendingTest ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Mail className="w-3.5 h-3.5 mr-1" />}
                Send Test
              </Button>
            </div>
            <Button
              size="sm"
              variant="retail"
              onClick={sendCampaign}
              disabled={sending || !subject || !html || !consent || !recipientInfo?.deliverable}
            >
              {sending ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Send className="w-3.5 h-3.5 mr-1" />}
              {sending ? "Sending…" : `Send to ${recipientInfo?.deliverable ?? 0} recipients`}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Campaigns */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-muted-foreground" />
            Campaigns
          </CardTitle>
        </CardHeader>
        <CardContent>
          {campaigns.length === 0 ? (
            <div className="text-center py-8">
              <Megaphone className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No campaigns sent yet.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {campaigns.map((c) => {
                const openRate = c.metrics.sent ? Math.round((c.metrics.opens / c.metrics.sent) * 100) : 0
                const clickRate = c.metrics.sent ? Math.round((c.metrics.clicks / c.metrics.sent) * 100) : 0
                const expanded = expandedId === c.id
                return (
                  <div key={c.id}>
                    <button
                      type="button"
                      onClick={() => toggleExpand(c.id)}
                      className="w-full text-left rounded-lg border border-border bg-muted/20 p-4 hover:bg-muted/40 transition-colors"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                          {expanded ? <ChevronDown className="w-4 h-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 shrink-0 text-muted-foreground" />}
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-foreground truncate">{c.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {AUDIENCE_LABELS[c.audience] || c.audience} · {c.provider === "default" ? "default provider" : c.provider} · {new Date(c.sentAt).toLocaleDateString()} · by {c.createdBy}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-xs shrink-0">
                          <span className="flex items-center gap-1"><Mail className="w-3 h-3 text-muted-foreground" /> <strong>{c.metrics.sent}</strong> sent{c.metrics.failed > 0 && <span className="text-red-500"> ({c.metrics.failed} failed)</span>}</span>
                          <span className="flex items-center gap-1"><Eye className="w-3 h-3 text-blue-500" /> <strong>{c.metrics.opens}</strong> opens <span className="text-muted-foreground">({openRate}%)</span></span>
                          <span className="flex items-center gap-1"><MousePointerClick className="w-3 h-3 text-violet-500" /> <strong>{c.metrics.clicks}</strong> clicks <span className="text-muted-foreground">({clickRate}%)</span></span>
                        </div>
                      </div>
                    </button>

                    {expanded && (
                      <div className="border border-t-0 border-border rounded-b-lg bg-muted/10 p-4">
                        {loadingSends ? (
                          <p className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading recipients…</p>
                        ) : (
                          <div className="space-y-1">
                            {sends.map((s) => (
                              <div key={s.id} className="flex items-center justify-between text-xs rounded bg-background px-3 py-2">
                                <span className="truncate">
                                  {s.name ? <span className="font-medium">{s.name} — </span> : null}{s.email}
                                </span>
                                <span className="flex items-center gap-3 shrink-0 text-muted-foreground">
                                  {s.status === "failed" ? (
                                    <span className="flex items-center gap-1 text-red-500"><AlertCircle className="w-3 h-3" /> failed</span>
                                  ) : (
                                    <span className="flex items-center gap-1 text-green-600"><CheckCircle2 className="w-3 h-3" /> sent</span>
                                  )}
                                  {s.opened_at && <span className="flex items-center gap-1 text-blue-600"><Eye className="w-3 h-3" /> opened{s.open_count > 1 ? ` ×${s.open_count}` : ""}</span>}
                                  {s.clicked_at && <span className="flex items-center gap-1 text-violet-600"><MousePointerClick className="w-3 h-3" /> clicked{s.click_count > 1 ? ` ×${s.click_count}` : ""}</span>}
                                </span>
                              </div>
                            ))}
                            {sends.length === 0 && <p className="text-sm text-muted-foreground">No sends recorded.</p>}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
