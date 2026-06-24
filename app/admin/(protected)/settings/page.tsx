"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, Save, Settings, Sparkles } from "lucide-react"

interface GeneralSettings {
  contactEmail: string
  whatsappNumber: string
  companyName: string
}

interface OpenAISettings {
  apiKey: string
}

interface SocialSettings {
  facebook: string
  instagram: string
  twitter: string
  linkedin: string
}

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<GeneralSettings>({
    contactEmail: "",
    whatsappNumber: "",
    companyName: "",
  })
  const [social, setSocial] = useState<SocialSettings>({
    facebook: "",
    instagram: "",
    twitter: "",
    linkedin: "",
  })
  const [openai, setOpenai] = useState<OpenAISettings>({
    apiKey: "",
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")

  useEffect(() => {
    fetch("/api/admin/settings", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (data.general) setSettings(data.general)
        if (data.social) setSocial(data.social)
        if (data.openai) setOpenai(data.openai)
      })
      .finally(() => setLoading(false))
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMessage("")

    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ general: settings, social, openai }),
      })

      const data = await res.json()
      if (data.success) {
        setMessage("Settings saved successfully.")
      } else {
        setMessage(data.error || "Failed to save.")
      }
    } catch {
      setMessage("Something went wrong.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Settings className="w-5 h-5" />
          General Settings
        </h2>
        <p className="text-muted-foreground">Update contact details and site identity.</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4 max-w-2xl">
          <Card>
            <CardHeader>
              <CardTitle>Contact Information</CardTitle>
              <CardDescription>Used across forms and CTAs on the site.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Company Name</label>
                <input
                  type="text"
                  value={settings.companyName}
                  onChange={(e) => setSettings({ ...settings, companyName: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="MartPoint"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Contact Email</label>
                <input
                  type="email"
                  value={settings.contactEmail}
                  onChange={(e) => setSettings({ ...settings, contactEmail: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="hello@martpoint.com.ng"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">WhatsApp Number</label>
                <input
                  type="text"
                  value={settings.whatsappNumber}
                  onChange={(e) => setSettings({ ...settings, whatsappNumber: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="+2348036028069"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Social Media Links</CardTitle>
              <CardDescription>Links to your social media profiles displayed in the footer.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Facebook URL</label>
                <input
                  type="url"
                  value={social.facebook}
                  onChange={(e) => setSocial({ ...social, facebook: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="https://facebook.com/martpoint.ng"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Instagram URL</label>
                <input
                  type="url"
                  value={social.instagram}
                  onChange={(e) => setSocial({ ...social, instagram: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="https://instagram.com/martpoint.ng"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Twitter / X URL</label>
                <input
                  type="url"
                  value={social.twitter}
                  onChange={(e) => setSocial({ ...social, twitter: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="https://x.com/martpointng"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">LinkedIn URL</label>
                <input
                  type="url"
                  value={social.linkedin}
                  onChange={(e) => setSocial({ ...social, linkedin: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="https://linkedin.com/company/martpoint"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-retail" />
                OpenAI Configuration
              </CardTitle>
              <CardDescription>API key for AI content generation in the blog editor.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">OpenAI API Key</label>
                <input
                  type="password"
                  value={openai.apiKey}
                  onChange={(e) => setOpenai({ apiKey: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="sk-xxxxxxxxxxxxxxxxxxxxxxxx"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Get your key from <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-retail underline">platform.openai.com</a>. Falls back to OPENAI_API_KEY env variable if empty.
                </p>
              </div>
            </CardContent>
          </Card>

          {message && (
            <p className={`text-sm ${message.includes("success") ? "text-green-600" : "text-red-500"}`}>
              {message}
            </p>
          )}

          <Button type="submit" disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Settings
              </>
            )}
          </Button>
        </form>
      )}
    </div>
  )
}
