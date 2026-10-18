"use client"

import { useEffect, useState } from "react"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, Save, Phone, MessageCircle, Save as SaveIcon } from "lucide-react"

interface AzeraSettings {
  widget_enabled: boolean
  widget_title: string
  widget_greeting: string
  brand_color: string
  position: "bottom-right" | "bottom-left"
  ai_enabled: boolean
  ai_prompt: string | null
  ai_voice_enabled: boolean
  ai_voice_provider: string | null
  ai_voice: string | null
  sip_provider: string | null
  sip_from_number: string | null
  africas_talking_api_key: string | null
  africas_talking_username: string | null
  twilio_account_sid: string | null
  twilio_auth_token: string | null
  twilio_from: string | null
  messenger_page_id: string | null
  instagram_account_id: string | null
  google_place_id: string | null
  google_review_enabled: boolean
  google_review_message: string | null
}

export default function AzeraSettingsPage() {
  const [settings, setSettings] = useState<AzeraSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")

  // Local form state
  const [form, setForm] = useState<AzeraSettings>({
    widget_enabled: true,
    widget_title: "Chat with us",
    widget_greeting: "Hello! How can we help you today?",
    brand_color: "#0057FF",
    position: "bottom-right" as "bottom-right" | "bottom-left",
    ai_enabled: true,
    ai_prompt: "",
    ai_voice_enabled: false,
    ai_voice_provider: "openai",
    ai_voice: "alloy",
    sip_provider: null,
    sip_from_number: null,
    africas_talking_api_key: null,
    africas_talking_username: null,
    twilio_account_sid: null,
    twilio_auth_token: null,
    twilio_from: null,
    messenger_page_id: null,
    instagram_account_id: null,
    google_place_id: null,
    google_review_enabled: false,
    google_review_message: null,
  })

  useEffect(() => {
    loadSettings()
  }, [])

  async function loadSettings() {
    try {
      const res = await fetch("/api/azera/settings?business_id=1")
      const json = await res.json()
      if (json.settings) {
        setSettings(json.settings)
        setForm(json.settings)
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  async function saveSettings() {
    setSaving(true)
    setMessage("")
    try {
      const res = await fetch("/api/azera/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          business_id: 1,
          ...form,
        }),
      })
      const json = await res.json()
      if (json.success) {
        setMessage("Settings saved successfully")
        setSettings(json.settings)
        setTimeout(() => setMessage(""), 3000)
      } else {
        setMessage(json.error || "Failed to save settings")
      }
    } catch {
      setMessage("Failed to save settings")
    } finally {
      setSaving(false)
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
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <MessageCircle className="w-5 h-5 text-retail" />
          Azera Settings
        </h1>
        <p className="text-muted-foreground">
          Configure the Azera live chat widget and phone call settings for your
          business.
        </p>
      </div>

      {message && (
        <p className={`text-sm ${message.includes("success") ? "text-green-600" : "text-red-500"}`}>
          {message}
        </p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Widget Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Chat Widget</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input
                  type="checkbox"
                  checked={form.widget_enabled}
                  onChange={(e) =>
                    setForm({ ...form, widget_enabled: e.target.checked })
                  }
                  className="rounded border-retail text-retail focus:ring-retail"
                />
                Enable chat widget on website
              </label>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium">Widget title</label>
              <input
                value={form.widget_title}
                onChange={(e) =>
                  setForm({ ...form, widget_title: e.target.value })
                }
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium">Greeting message</label>
              <textarea
                value={form.widget_greeting}
                onChange={(e) =>
                  setForm({ ...form, widget_greeting: e.target.value })
                }
                rows={2}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium">Brand color</label>
              <input
                type="color"
                value={form.brand_color}
                onChange={(e) =>
                  setForm({ ...form, brand_color: e.target.value })
                }
                className="w-10 h-10 rounded-lg border-none bg-transparent cursor-pointer"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium">Position</label>
              <select
                value={form.position}
                onChange={(e) =>
                  setForm({
                    ...form,
                    position: e.target.value as "bottom-right" | "bottom-left",
                  })
                }
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="bottom-right">Bottom Right</option>
                <option value="bottom-left">Bottom Left</option>
              </select>
            </div>
          </CardContent>
        </Card>

        {/* AI Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">AI Assistant</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input
                  type="checkbox"
                  checked={form.ai_enabled}
                  onChange={(e) => setForm({ ...form, ai_enabled: e.target.checked })}
                  className="rounded border-retail text-retail focus:ring-retail"
                />
                Enable AI auto-replies
              </label>
              <p className="text-xs text-muted-foreground">
                AI answers common questions using your knowledge base articles.
                Set your OpenAI key in Admin → Settings.
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium">AI system prompt</label>
              <textarea
                value={form.ai_prompt || ""}
                onChange={(e) => setForm({ ...form, ai_prompt: e.target.value })}
                rows={3}
                placeholder="Custom instructions for Azera..."
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
          </CardContent>
        </Card>

        {/* AI Voice Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">AI Voice Calls</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input
                  type="checkbox"
                  checked={form.ai_voice_enabled}
                  onChange={(e) =>
                    setForm({ ...form, ai_voice_enabled: e.target.checked })
                  }
                  className="rounded border-retail text-retail focus:ring-retail"
                />
                Enable AI voice answering
              </label>
              <p className="text-xs text-muted-foreground">
                AI answers phone calls using OpenAI Whisper + GPT + TTS.
                Transfers to human agent when needed.
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium">TTS Voice</label>
              <select
                value={form.ai_voice || "alloy"}
                onChange={(e) => setForm({ ...form, ai_voice: e.target.value })}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="alloy">Alloy (neutral)</option>
                <option value="echo">Echo</option>
                <option value="fable">Fable</option>
                <option value="onyx">Onyx</option>
                <option value="nova">Nova</option>
                <option value="shimmer">Shimmer</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium">Provider</label>
              <select
                value={form.ai_voice_provider || "openai"}
                onChange={(e) =>
                  setForm({ ...form, ai_voice_provider: e.target.value })
                }
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="openai">OpenAI (Whisper + GPT + TTS)</option>
              </select>
            </div>
          </CardContent>
        </Card>

        {/* Messenger Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Facebook Messenger</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-medium">Page ID</label>
              <input
                value={form.messenger_page_id || ""}
                onChange={(e) =>
                  setForm({ ...form, messenger_page_id: e.target.value })
                }
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="Your Messenger Page ID"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Set up webhook at: /api/azera/webhook/messenger · Verify token:
              MESSENGER_VERIFY_TOKEN
            </p>
          </CardContent>
        </Card>

        {/* Instagram Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Instagram DM</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-medium">Instagram Account ID</label>
              <input
                value={form.instagram_account_id || ""}
                onChange={(e) =>
                  setForm({ ...form, instagram_account_id: e.target.value })
                }
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="Your Instagram Account ID"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Set up webhook at: /api/azera/webhook/instagram · Verify token:
              INSTAGRAM_VERIFY_TOKEN
            </p>
          </CardContent>
        </Card>

        {/* Google Reviews Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Google Reviews</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input
                  type="checkbox"
                  checked={form.google_review_enabled}
                  onChange={(e) =>
                    setForm({ ...form, google_review_enabled: e.target.checked })
                  }
                  className="rounded border-retail text-retail focus:ring-retail"
                />
                Enable Google review requests
              </label>
              <p className="text-xs text-muted-foreground">
                Send customers a link to leave a Google review after service.
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium">Google Place ID</label>
              <input
                value={form.google_place_id || ""}
                onChange={(e) =>
                  setForm({ ...form, google_place_id: e.target.value })
                }
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="Your Google Business Place ID"
              />
              <p className="text-xs text-muted-foreground">
                Find it at: https://developers.google.com/maps/documentation/places/web-service/get-place-id
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium">Review request message</label>
              <textarea
                value={form.google_review_message || ""}
                onChange={(e) =>
                  setForm({ ...form, google_review_message: e.target.value })
                }
                rows={2}
                placeholder="Hi {{name}}, how was your experience? Leave us a review: {{link}}"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
          </CardContent>
        </Card>

        {/* SIP / Phone Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Phone Calls (SIP)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-medium">SIP Provider</label>
              <select
                value={form.sip_provider || ""}
                onChange={(e) =>
                  setForm({ ...form, sip_provider: e.target.value })
                }
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">None (internet calls only)</option>
                <option value="africas_talking">Africa's Talking</option>
                <option value="twilio">Twilio</option>
                <option value="generic">Generic Webhook</option>
              </select>
              {form.sip_provider === "africas_talking" && (
                <div className="space-y-2 pt-2 border-t border-border/50">
                  <div className="space-y-2">
                    <label className="text-xs font-medium">API Key</label>
                    <input
                      type="password"
                      value={form.africas_talking_api_key || ""}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          africas_talking_api_key: e.target.value,
                        })
                      }
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      placeholder="sk_live_..."
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium">Username</label>
                    <input
                      value={form.africas_talking_username || ""}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          africas_talking_username: e.target.value,
                        })
                      }
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      placeholder="yourusername"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium">From Number (020 Lagos)</label>
                    <input
                      value={form.sip_from_number || ""}
                      onChange={(e) =>
                        setForm({ ...form, sip_from_number: e.target.value })
                      }
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      placeholder="+23420xxxxxxx"
                    />
                  </div>
                </div>
              )}
              {form.sip_provider === "twilio" && (
                <div className="space-y-2 pt-2 border-t border-border/50">
                  <div className="space-y-2">
                    <label className="text-xs font-medium">Account SID</label>
                    <input
                      value={form.twilio_account_sid || ""}
                      onChange={(e) =>
                        setForm({ ...form, twilio_account_sid: e.target.value })
                      }
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium">Auth Token</label>
                    <input
                      type="password"
                      value={form.twilio_auth_token || ""}
                      onChange={(e) =>
                        setForm({ ...form, twilio_auth_token: e.target.value })
                      }
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium">From Number</label>
                    <input
                      value={form.twilio_from || ""}
                      onChange={(e) =>
                        setForm({ ...form, twilio_from: e.target.value })
                      }
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      placeholder="+1xxxxxxxxxx"
                    />
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button
          onClick={saveSettings}
          disabled={saving}
          className="bg-retail text-white"
        >
          {saving ? <SaveIcon className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Save Settings
        </Button>
      </div>
    </div>
  )
}
