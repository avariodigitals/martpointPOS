"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ImageUpload } from "@/components/admin/image-upload"
import { Loader2, Save, Search } from "lucide-react"

interface SeoSettings {
  title: string
  description: string
  keywords: string
  ogImage: string
}

export default function AdminSeoPage() {
  const [settings, setSettings] = useState<SeoSettings>({
    title: "",
    description: "",
    keywords: "",
    ogImage: "",
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")

  useEffect(() => {
    fetch("/api/admin/settings", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (data.seo) setSettings(data.seo)
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
        body: JSON.stringify({ seo: settings }),
      })

      let data: Record<string, unknown> = {}
      const text = await res.text()
      try {
        data = JSON.parse(text)
      } catch {
        console.error("Non-JSON response:", text.slice(0, 500))
        setMessage(`Server error (${res.status}). Check console for details.`)
        setSaving(false)
        return
      }

      if (res.ok && data.success) {
        setMessage("SEO settings saved successfully.")
      } else {
        const errorMsg = (data.error as string) || `Failed to save (${res.status}).`
        console.error("Save error:", errorMsg, data)
        setMessage(errorMsg)
      }
    } catch (err) {
      console.error("Network or unexpected error:", err)
      setMessage("Network error. Check your connection and try again.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Search className="w-5 h-5" />
          SEO Settings
        </h2>
        <p className="text-muted-foreground">Manage how your site appears in search results.</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4 max-w-2xl">
          <Card>
            <CardHeader>
              <CardTitle>Meta Tags</CardTitle>
              <CardDescription>These values appear in search engine results and social shares.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Site Title</label>
                <input
                  type="text"
                  value={settings.title}
                  onChange={(e) => setSettings({ ...settings, title: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="MartPoint — Retail & ERP Software..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Meta Description</label>
                <textarea
                  value={settings.description}
                  onChange={(e) => setSettings({ ...settings, description: e.target.value })}
                  rows={3}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="Brief description of your business..."
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {settings.description.length} / 160 characters recommended
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Keywords</label>
                <input
                  type="text"
                  value={settings.keywords}
                  onChange={(e) => setSettings({ ...settings, keywords: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="pos software, inventory management, retail nigeria"
                />
              </div>
              <ImageUpload
                label="OG Image"
                folder="og"
                value={settings.ogImage}
                onChange={(url) => setSettings({ ...settings, ogImage: url })}
              />
            </CardContent>
          </Card>

          {message && (
            <p className={`text-sm ${message.includes("success") ? "text-green-600" : "text-red-500"}`}>
              {message}
            </p>
          )}

          <div className="flex items-center gap-4">
            <Button type="submit" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save SEO Settings
                </>
              )}
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            Note: Changes are saved to a config file. For metadata to update on the public site, a redeploy is required.
          </p>
        </form>
      )}
    </div>
  )
}
