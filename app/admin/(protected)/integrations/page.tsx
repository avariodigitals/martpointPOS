"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, Save, Phone, Radio, Megaphone, Copy, RefreshCw } from "lucide-react"

interface LiveKitSettings {
  serverUrl: string
  publicUrl: string
  apiKey: string
  apiSecret: string
  sipHostname: string
  sipUsername: string
  sipPassword: string
  sipNumber: string
  destinationCountry: string
}

interface WhatsAppSettings {
  apiKey: string
  baseUrl: string
  webhookSecret: string
  phoneNumber: string
}

const defaultLiveKit: LiveKitSettings = {
  serverUrl: "",
  publicUrl: "",
  apiKey: "",
  apiSecret: "",
  sipHostname: "sip.za.didlogic.net",
  sipUsername: "",
  sipPassword: "",
  sipNumber: "",
  destinationCountry: "NG",
}

const defaultWhatsApp: WhatsAppSettings = {
  apiKey: "",
  baseUrl: "https://waba-v2.360dialog.io",
  webhookSecret: "",
  phoneNumber: "",
}

interface AdLeadsSettings {
  webhookSecret: string
  tiktokAppSecret: string
}

const defaultAdLeads: AdLeadsSettings = {
  webhookSecret: "",
  tiktokAppSecret: "",
}

export default function IntegrationsPage() {
  const [livekit, setLivekit] = useState<LiveKitSettings>(defaultLiveKit)
  const [whatsapp, setWhatsapp] = useState<WhatsAppSettings>(defaultWhatsApp)
  const [adLeads, setAdLeads] = useState<AdLeadsSettings>(defaultAdLeads)
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")

  useEffect(() => {
    fetch("/api/admin/settings", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (data.livekit) setLivekit((prev) => ({ ...prev, ...data.livekit }))
        if (data.whatsapp) setWhatsapp((prev) => ({ ...prev, ...data.whatsapp }))
        if (data.adLeads) setAdLeads((prev) => ({ ...prev, ...data.adLeads }))
      })
      .catch(() => setMessage("Failed to load settings"))
      .finally(() => setLoading(false))
  }, [])

  const save = async () => {
    setSaving(true)
    setMessage("")
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ livekit, whatsapp, adLeads }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setMessage("Saved successfully.")
      } else {
        setMessage(data.error || "Failed to save.")
      }
    } catch {
      setMessage("Failed to save.")
    } finally {
      setSaving(false)
    }
  }

  const input = (label: string, value: string, onChange: (v: string) => void, type = "text") => (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
      />
    </div>
  )

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading integrations…
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Integrations</h2>
        <p className="text-muted-foreground">Configure LiveKit calls and WhatsApp from the admin instead of Vercel env.</p>
      </div>

      {message && (
        <p className={`text-sm ${message.includes("success") ? "text-green-600" : "text-red-500"}`}>{message}</p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Radio className="w-4 h-4" /> LiveKit Calls
            </CardTitle>
            <CardDescription>Voice call provider via didlogic SIP trunk.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {input("Server URL (https)", livekit.serverUrl, (v) => setLivekit({ ...livekit, serverUrl: v }))}
            {input("Public URL (wss)", livekit.publicUrl, (v) => setLivekit({ ...livekit, publicUrl: v }))}
            {input("API Key", livekit.apiKey, (v) => setLivekit({ ...livekit, apiKey: v }))}
            {input("API Secret", livekit.apiSecret, (v) => setLivekit({ ...livekit, apiSecret: v }), "password")}
            {input("SIP Hostname", livekit.sipHostname, (v) => setLivekit({ ...livekit, sipHostname: v }))}
            {input("SIP Username", livekit.sipUsername, (v) => setLivekit({ ...livekit, sipUsername: v }))}
            {input("SIP Password", livekit.sipPassword, (v) => setLivekit({ ...livekit, sipPassword: v }), "password")}
            {input("SIP Number", livekit.sipNumber, (v) => setLivekit({ ...livekit, sipNumber: v }))}
            {input("Destination Country", livekit.destinationCountry, (v) => setLivekit({ ...livekit, destinationCountry: v }))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Phone className="w-4 h-4" /> WhatsApp
            </CardTitle>
            <CardDescription>360dialog connection for the custom inbox.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {input("API Key", whatsapp.apiKey, (v) => setWhatsapp({ ...whatsapp, apiKey: v }), "password")}
            {input("Base URL", whatsapp.baseUrl, (v) => setWhatsapp({ ...whatsapp, baseUrl: v }))}
            {input("Webhook Secret", whatsapp.webhookSecret, (v) => setWhatsapp({ ...whatsapp, webhookSecret: v }), "password")}
            {input("Business Phone Number", whatsapp.phoneNumber, (v) => setWhatsapp({ ...whatsapp, phoneNumber: v }))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Megaphone className="w-4 h-4" /> Ad Lead Webhooks
            </CardTitle>
            <CardDescription>
              Inbound leads from TikTok (and later Meta). Point Make.com or TikTok&apos;s native
              webhook subscription at the endpoint below.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Webhook Endpoint</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={`${typeof window !== "undefined" ? window.location.origin : ""}/api/webhooks/tiktok-leads${adLeads.webhookSecret ? `?secret=${adLeads.webhookSecret}` : ""}`}
                  className="w-full rounded-md border border-input bg-muted px-3 py-2 text-sm font-mono"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const url = `${window.location.origin}/api/webhooks/tiktok-leads${adLeads.webhookSecret ? `?secret=${adLeads.webhookSecret}` : ""}`
                    navigator.clipboard.writeText(url).then(() => {
                      setCopied(true)
                      setTimeout(() => setCopied(false), 2000)
                    })
                  }}
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
              {copied && <p className="text-xs text-green-600 mt-1">Copied.</p>}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Shared Webhook Secret (Make.com relay)</label>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={adLeads.webhookSecret}
                  onChange={(e) => setAdLeads({ ...adLeads, webhookSecret: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setAdLeads({ ...adLeads, webhookSecret: crypto.randomUUID() })}
                >
                  <RefreshCw className="w-4 h-4" />
                </Button>
              </div>
            </div>
            {input("TikTok App Secret (native webhook mode)", adLeads.tiktokAppSecret, (v) => setAdLeads({ ...adLeads, tiktokAppSecret: v }), "password")}
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
          Save Integrations
        </Button>
      </div>
    </div>
  )
}
