"use client"

import { useEffect, useState } from "react"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, Save, MessageCircle, Save as SaveIcon } from "lucide-react"
import { VoiceDepartmentsEditor } from "@/components/admin/voice-departments-editor"
import { departmentFallbacks, type VoiceDepartmentForm } from "@/lib/voice-department-form"

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
  openaiConfigured?: boolean
  fallbackConfigured?: boolean
  configured?: boolean
  sip_provider: string | null
  sip_from_number: string | null
  africas_talking_phone_number: string | null
  africas_talking_forward_numbers: string
  voice_greeting: string
  voice_connecting_greeting: string
  voice_no_answer_greeting: string
  voice_busy_greeting: string
  voice_after_hours_greeting: string
  voice_after_hours_destination: string
  voice_timezone: string
  voice_weekly_schedule: string
  voice_closed_dates: string
  voice_menu_retry_limit: number
  voice_menu_enabled: boolean
  voice_departments: VoiceDepartmentForm[]
  voice_voicemail_enabled: boolean
  voice_voicemail_max_seconds: number
  voice_voicemail_retention_days: number
  voice_greeting_audio_url: string
  voice_connecting_audio_url: string
  voice_no_answer_audio_url: string
  voice_after_hours_audio_url: string
  voice_waiting_audio_url: string
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
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")
  const [voiceProviderCheck, setVoiceProviderCheck] = useState("")

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
    africas_talking_phone_number: null,
    africas_talking_forward_numbers: "",
    voice_greeting: "Welcome to MartPoint, the business management software built for Nigerian businesses. Manage your sales, inventory, customer payments, and online store—all in one place. For sales, pricing, or to book a demo, press 1. For technical support, press 2. For billing, renewals, or onboarding, press 3. To hear these options again, press 9.",
    voice_connecting_greeting: "Please hold while we connect you.",
    voice_no_answer_greeting: "We are unable to answer right now. Please try again later.",
    voice_busy_greeting: "All our care agents are currently busy. Please try again later.",
    voice_after_hours_greeting: "Our office is currently closed. Please hold while I direct you to our after-hours support team.",
    voice_after_hours_destination: "",
    voice_timezone: "Africa/Lagos",
    voice_weekly_schedule: "Mon | 09:00-17:00\nTue | 09:00-17:00\nWed | 09:00-17:00\nThu | 09:00-17:00\nFri | 09:00-17:00",
    voice_closed_dates: "",
    voice_menu_retry_limit: 1,
    voice_menu_enabled: false,
    voice_departments: [],
    voice_voicemail_enabled: false,
    voice_voicemail_max_seconds: 60,
    voice_voicemail_retention_days: 90,
    voice_greeting_audio_url: "",
    voice_connecting_audio_url: "",
    voice_no_answer_audio_url: "",
    voice_after_hours_audio_url: "",
    voice_waiting_audio_url: "",
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

  async function loadSettings() {
    try {
      const res = await fetch("/api/azera/settings?business_id=1")
      const json = await res.json()
      setForm((current) => {
        const settings = json.settings || {}
        return {
          ...current,
          ...settings,
          ...(json.ai_provider || {}),
          africas_talking_forward_numbers: Array.isArray(settings.africas_talking_forward_numbers)
            ? settings.africas_talking_forward_numbers.join(", ")
            : settings.africas_talking_forward_numbers || "",
          voice_weekly_schedule: settings.voice_weekly_schedule
            ? Object.entries(settings.voice_weekly_schedule as Record<string, { open?: string; close?: string } | null>)
                .filter(([, value]) => value)
                .map(([day, value]) => `${day.slice(0, 1).toUpperCase()}${day.slice(1)} | ${value?.open || ""}-${value?.close || ""}`)
                .join("\n")
            : current.voice_weekly_schedule,
          voice_closed_dates: Array.isArray(settings.voice_closed_dates) ? settings.voice_closed_dates.join(", ") : current.voice_closed_dates,
          voice_departments: (() => {
            if (!Array.isArray(settings.voice_departments)) return []
            const usedDigits = new Set<number>()
            return settings.voice_departments.map((department: { digit?: number; label?: string; primary?: string; fallback?: string[]; numbers?: string[]; enabled?: boolean }, index: number) => {
              const requestedDigit = Number(department.digit || index + 1)
              const digit = Number.isInteger(requestedDigit) && requestedDigit >= 1 && requestedDigit <= 8 && !usedDigits.has(requestedDigit)
                ? requestedDigit
                : Array.from({ length: 8 }, (_, offset) => offset + 1).find((candidate) => !usedDigits.has(candidate)) || ""
              if (digit) usedDigits.add(Number(digit))
              return {
                id: crypto.randomUUID(),
                digit: String(digit),
                label: department.label || "",
                primary: department.primary || department.numbers?.[0] || "",
                fallback: Array.isArray(department.fallback) ? department.fallback.join(", ") : (department.numbers || []).slice(1).join(", "),
                enabled: department.enabled !== false,
              }
            })
          })(),
        }
      })
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // The request synchronizes the form with the persisted admin settings.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadSettings()
  }, [])

  async function uploadAudio(key: "voice_greeting_audio_url" | "voice_connecting_audio_url" | "voice_no_answer_audio_url" | "voice_after_hours_audio_url" | "voice_waiting_audio_url", file: File) {
    const body = new FormData()
    body.append("business_id", "1")
    body.append("file", file)
    const res = await fetch("/api/azera/voice-audio", { method: "POST", body })
    const json = await res.json()
    if (!res.ok || !json.url) {
      setMessage(json.error || "Audio upload failed")
      return
    }
    setForm((current) => ({ ...current, [key]: json.url }))
    setMessage("Audio uploaded. Save settings to activate it.")
  }

  async function checkVoiceProvider() {
    setVoiceProviderCheck("Checking provider…")
    try {
      const provider = encodeURIComponent(form.ai_voice_provider || "openai")
      const res = await fetch(`/api/azera/voice/provider-check?business_id=1&provider=${provider}`)
      const json = await res.json()
      setVoiceProviderCheck(json.message || json.error || "Provider check failed")
    } catch {
      setVoiceProviderCheck("Provider check failed")
    }
  }

  async function saveSettings() {
    setSaving(true)
    setMessage("")
    try {
      const seenDigits = new Set<number>()
      const departments = form.voice_departments
        .filter((department) => department.label.trim() || department.primary.trim() || department.fallback.trim())
        .map((department) => {
          const digit = Number(department.digit)
          if (!Number.isInteger(digit) || digit < 1 || digit > 8 || seenDigits.has(digit)) throw new Error("Department digits must be unique numbers from 1 to 8. Digit 9 repeats the menu.")
          seenDigits.add(digit)
          const primary = department.primary.trim()
          const fallback = departmentFallbacks(department.fallback)
          if (!department.label.trim() || !primary) throw new Error("Each enabled department needs a name and primary destination.")
          return {
            digit,
            key: department.label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
            label: department.label.trim(),
            primary,
            fallback,
            numbers: [primary, ...fallback],
            enabled: department.enabled,
          }
        })
      const weeklySchedule: Record<string, { open: string; close: string } | null> = {}
      for (const line of form.voice_weekly_schedule.split("\n").map((value) => value.trim()).filter(Boolean)) {
        const [rawDay, rawHours] = line.split("|").map((value) => value.trim())
        if (!rawDay || !rawHours) throw new Error("Business hours must use one line per day, such as Mon | 09:00-17:00.")
        const [open, close] = rawHours.split("-").map((value) => value.trim())
        const day = rawDay.slice(0, 3).toLowerCase()
        if (!["mon", "tue", "wed", "thu", "fri", "sat", "sun"].includes(day) || !/^\d{2}:\d{2}$/.test(open || "") || !/^\d{2}:\d{2}$/.test(close || "")) throw new Error("Business hours contain an invalid day or time.")
        weeklySchedule[day] = { open, close }
      }
      for (const day of ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]) if (!weeklySchedule[day]) weeklySchedule[day] = null

      const res = await fetch("/api/azera/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          business_id: 1,
          ...form,
          africas_talking_forward_numbers: form.africas_talking_forward_numbers
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean),
          voice_departments: departments,
          voice_weekly_schedule: weeklySchedule,
          voice_closed_dates: form.voice_closed_dates.split(",").map((value) => value.trim()).filter(Boolean),
        }),
      })
      const json = await res.json()
      if (json.success) {
        setMessage("Settings saved successfully")
        setTimeout(() => setMessage(""), 3000)
      } else {
        setMessage(json.error || "Failed to save settings")
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to save settings")
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
    <div className="min-w-0 space-y-6 [&_input]:min-w-0 [&_input]:max-w-full [&_select]:min-w-0 [&_textarea]:min-w-0 [&_code]:break-all">
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

      <div className="grid min-w-0 grid-cols-1 items-start gap-6 md:grid-cols-2 xl:grid-cols-3 [&>div]:min-w-0">
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
                Configure a provider before enabling auto-replies.
              </p>
            </div>
            <div className={`rounded-lg border px-3 py-3 text-sm ${form.configured ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
              <p className="font-semibold">{form.configured ? "AI provider connected" : "AI provider not configured"}</p>
              <p className="mt-1 text-xs opacity-85">
                {form.openaiConfigured ? "OpenAI is ready." : "OpenAI is not connected."}{" "}
                {form.fallbackConfigured ? "A fallback provider is ready." : "No fallback provider is connected."}
              </p>
              {!form.configured && (
                <a href="/admin/settings#openai-configuration" className="mt-2 inline-block text-xs font-semibold underline underline-offset-2">
                  Configure AI provider in Admin Settings →
                </a>
              )}
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
                AI uses the selected provider for speech-to-text, chat, and text-to-speech when that provider exposes OpenAI-compatible voice endpoints. Transfers to a human agent when needed.
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
                <option value="groq">Groq (OpenAI-compatible endpoint)</option>
                <option value="gemini">Gemini (OpenAI-compatible endpoint)</option>
                <option value="mistral">Mistral (OpenAI-compatible endpoint)</option>
                <option value="openrouter">OpenRouter (OpenAI-compatible endpoint)</option>
                <option value="xai">xAI (OpenAI-compatible endpoint)</option>
                <option value="custom">Custom OpenAI-compatible provider</option>
              </select>
              <div className="flex items-center gap-3">
                <Button type="button" variant="outline" size="sm" onClick={() => void checkVoiceProvider()}>
                  Check selected provider
                </Button>
                {voiceProviderCheck && <span className="text-xs text-muted-foreground">{voiceProviderCheck}</span>}
              </div>
              <p className="text-xs text-muted-foreground">
                The selected provider must support <code>/audio/transcriptions</code>, <code>/chat/completions</code>, and <code>/audio/speech</code>. OpenAI is the currently configured provider in this installation.
              </p>
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
                placeholder="Hi {{name}}! Thanks for choosing {{businessName}}. We’d appreciate a quick Google review: {{link}}"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
              <p className="text-xs text-muted-foreground">Use <code>{"{{name}}"}</code>, <code>{"{{businessName}}"}</code>, and <code>{"{{link}}"}</code>. Review requests are tracked here; connect an outbound WhatsApp, SMS, or email sender before sending automatically.</p>
            </div>
          </CardContent>
        </Card>

        {/* SIP / Phone Settings */}
        <Card className="min-w-0 md:col-span-2 xl:col-span-3">
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
                <option value="africas_talking">Africa&apos;s Talking</option>
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
                    <label className="text-xs font-medium">From Number (outbound caller ID)</label>
                    <input
                      value={form.sip_from_number || ""}
                      onChange={(e) =>
                        setForm({ ...form, sip_from_number: e.target.value })
                      }
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      placeholder="+23420xxxxxxx"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium">Africa&apos;s Talking virtual number</label>
                    <input
                      value={form.africas_talking_phone_number || ""}
                      onChange={(e) =>
                        setForm({ ...form, africas_talking_phone_number: e.target.value })
                      }
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      placeholder="+23420xxxxxxx"
                    />
                    <p className="text-xs text-muted-foreground">
                      The number customers dial. This also lets the callback identify the business.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium">Answer calls on</label>
                    <input
                      value={form.africas_talking_forward_numbers}
                      onChange={(e) =>
                        setForm({ ...form, africas_talking_forward_numbers: e.target.value })
                      }
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      placeholder="+2348012345678"
                    />
                    <p className="text-xs text-muted-foreground">
                      Enter mobile numbers in international format or an Africa&apos;s Talking SIP destination such as <code>sales@youraccount.sip.africastalking.com</code>.
                    </p>
                  </div>
                  <div className="space-y-2 pt-2 border-t border-border/50">
                    <label className="text-xs font-medium">Main greeting and menu</label>
                    <textarea
                      value={form.voice_greeting}
                      onChange={(e) => setForm({ ...form, voice_greeting: e.target.value })}
                      rows={2}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      placeholder="Welcome to MartPoint... Press 1 for Sales."
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium">Connecting greeting</label>
                    <textarea
                      value={form.voice_connecting_greeting}
                      onChange={(e) => setForm({ ...form, voice_connecting_greeting: e.target.value })}
                      rows={2}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      placeholder="Please hold while we connect you."
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium">No-answer / voicemail greeting</label>
                    <textarea
                      value={form.voice_no_answer_greeting}
                      onChange={(e) => setForm({ ...form, voice_no_answer_greeting: e.target.value })}
                      rows={2}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      placeholder="We are unable to answer right now. Please try again later."
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium">All agents busy greeting</label>
                    <textarea
                      value={form.voice_busy_greeting}
                      onChange={(e) => setForm({ ...form, voice_busy_greeting: e.target.value })}
                      rows={2}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      placeholder="All our care agents are currently busy. Please try again later."
                    />
                    <p className="text-xs text-muted-foreground">Used when every destination in the selected department is already handling another call.</p>
                  </div>
                  <VoiceDepartmentsEditor
                    departments={form.voice_departments}
                    menuEnabled={form.voice_menu_enabled}
                    onChange={(voice_departments) => setForm((current) => ({ ...current, voice_departments }))}
                    onMenuChange={(voice_menu_enabled) => setForm((current) => ({ ...current, voice_menu_enabled }))}
                  />
                  <div className="grid gap-3 md:grid-cols-2 pt-2 border-t border-border/50">
                    <div className="space-y-2">
                      <label className="text-xs font-medium">Timezone</label>
                      <input value={form.voice_timezone} onChange={(e) => setForm({ ...form, voice_timezone: e.target.value })} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" placeholder="Africa/Lagos" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-medium">After-hours destination (optional)</label>
                      <input value={form.voice_after_hours_destination} onChange={(e) => setForm({ ...form, voice_after_hours_destination: e.target.value })} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" placeholder="+234... or agent@account.sip.africastalking.com" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium">After-hours greeting</label>
                    <textarea
                      value={form.voice_after_hours_greeting}
                      onChange={(e) => setForm({ ...form, voice_after_hours_greeting: e.target.value })}
                      rows={2}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      placeholder="Our office is currently closed. Please hold while I direct you to our after-hours support team."
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium">Weekly hours</label>
                    <textarea value={form.voice_weekly_schedule} onChange={(e) => setForm({ ...form, voice_weekly_schedule: e.target.value })} rows={4} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono" placeholder="Mon | 09:00-17:00" />
                    <p className="text-xs text-muted-foreground">One line per day, for example <code>Mon | 09:00-17:00</code>. Omitted days are closed. Timezone is applied on the server.</p>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium">Closed dates</label>
                    <input value={form.voice_closed_dates} onChange={(e) => setForm({ ...form, voice_closed_dates: e.target.value })} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" placeholder="2026-12-25, 2026-12-26" />
                  </div>
                  <div className="grid gap-3 md:grid-cols-3 pt-2 border-t border-border/50">
                    <div className="space-y-2">
                      <label className="text-xs font-medium">Menu retries</label>
                      <input type="number" min={0} max={3} value={form.voice_menu_retry_limit} onChange={(e) => setForm({ ...form, voice_menu_retry_limit: Number(e.target.value) })} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-medium">Voicemail max seconds</label>
                      <input type="number" min={15} max={300} value={form.voice_voicemail_max_seconds} onChange={(e) => setForm({ ...form, voice_voicemail_max_seconds: Number(e.target.value) })} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-medium">Retention days</label>
                      <input type="number" min={1} max={3650} value={form.voice_voicemail_retention_days} onChange={(e) => setForm({ ...form, voice_voicemail_retention_days: Number(e.target.value) })} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
                    </div>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer text-sm">
                    <input type="checkbox" checked={form.voice_voicemail_enabled} onChange={(e) => setForm({ ...form, voice_voicemail_enabled: e.target.checked })} className="rounded border-retail text-retail focus:ring-retail" />
                    Enable voicemail when no destination answers
                  </label>
                  <div className="space-y-2 pt-2 border-t border-border/50">
                    <label className="text-xs font-medium">Optional audio URLs</label>
                    <p className="text-xs text-muted-foreground">Use HTTPS WAV or MP3 URLs reachable by Africa&apos;s Talking. Leave blank to use text-to-speech.</p>
                    <div className="grid gap-2 md:grid-cols-2">
                      {([
                        ["voice_greeting_audio_url", "Main greeting audio"],
                        ["voice_connecting_audio_url", "Connecting audio"],
                        ["voice_no_answer_audio_url", "No-answer audio"],
                        ["voice_after_hours_audio_url", "After-hours audio"],
                        ["voice_waiting_audio_url", "Waiting / ringback audio"],
                      ] as const).map(([key, label]) => (
                        <div key={key} className="space-y-1">
                          <input value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" placeholder={`${label} (https://...)`} aria-label={label} />
                          <div className="flex items-center gap-2">
                            <input type="file" accept="audio/wav,audio/mpeg,audio/mp3" onChange={(e) => { const file = e.target.files?.[0]; if (file) void uploadAudio(key, file) }} className="min-w-0 flex-1 text-xs" aria-label={`Upload ${label}`} />
                            {form[key] && <button type="button" className="text-xs text-destructive hover:underline" onClick={() => setForm({ ...form, [key]: "" })}>Remove</button>}
                          </div>
                          {form[key] && <audio controls preload="none" src={form[key]} className="w-full h-8" />}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-md border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground">
                    <p className="font-medium text-foreground">Africa&apos;s Talking callback paths</p>
                    <p className="mt-1">Voice callback: <code>/api/africastalking/voice/callback</code></p>
                    <p>Voice events: <code>/api/africastalking/voice/events</code></p>
                    <p>Voice recording: <code>/api/africastalking/voice/recording</code></p>
                    <p>SMS: <code>/api/africastalking/sms</code> · USSD: <code>/api/africastalking/ussd</code></p>
                    <p>Airtime: <code>/api/africastalking/airtime/events</code></p>
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
