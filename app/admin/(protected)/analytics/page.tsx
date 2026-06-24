"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, Save, BarChart3, ExternalLink } from "lucide-react"

interface AnalyticsSettings {
  ga4MeasurementId: string
  gtmId: string
  fbPixelId: string
  clarityId: string
  hotjarId: string
}

export default function AdminAnalyticsPage() {
  const [settings, setSettings] = useState<AnalyticsSettings>({
    ga4MeasurementId: "",
    gtmId: "",
    fbPixelId: "",
    clarityId: "",
    hotjarId: "",
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")

  useEffect(() => {
    fetch("/api/admin/settings", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (data.analytics) setSettings(data.analytics)
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
        body: JSON.stringify({ analytics: settings }),
      })

      const data = await res.json()
      if (data.success) {
        setMessage("Analytics settings saved successfully.")
      } else {
        setMessage(data.error || "Failed to save.")
      }
    } catch {
      setMessage("Something went wrong.")
    } finally {
      setSaving(false)
    }
  }

  const gaActive = settings.ga4MeasurementId && settings.ga4MeasurementId.startsWith("G-")
  const fbActive = settings.fbPixelId && settings.fbPixelId.length > 0
  const clarityActive = settings.clarityId && settings.clarityId.length > 0
  const hotjarActive = settings.hotjarId && settings.hotjarId.length > 0

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <BarChart3 className="w-5 h-5" />
          Analytics
        </h2>
        <p className="text-muted-foreground">Configure tracking and view your data sources.</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-4 max-w-2xl">
          <Card>
            <CardHeader>
              <CardTitle>Tracking Integrations</CardTitle>
              <CardDescription>Add your IDs to enable tracking on the site.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* GA4 */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${gaActive ? "bg-green-500" : "bg-amber-500"}`} />
                  <span className="text-sm font-medium">Google Analytics 4</span>
                  <span className="text-xs text-muted-foreground">{gaActive ? "Active" : "Not Configured"}</span>
                </div>
                <input
                  type="text"
                  value={settings.ga4MeasurementId}
                  onChange={(e) => setSettings({ ...settings, ga4MeasurementId: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="G-XXXXXXXXXX"
                />
              </div>

              {/* GTM */}
              <div className="space-y-2">
                <span className="text-sm font-medium">Google Tag Manager (Optional)</span>
                <input
                  type="text"
                  value={settings.gtmId}
                  onChange={(e) => setSettings({ ...settings, gtmId: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="GTM-XXXXXXX"
                />
              </div>

              {/* Facebook Pixel */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${fbActive ? "bg-green-500" : "bg-amber-500"}`} />
                  <span className="text-sm font-medium">Facebook / Meta Pixel</span>
                  <span className="text-xs text-muted-foreground">{fbActive ? "Active" : "Not Configured"}</span>
                </div>
                <input
                  type="text"
                  value={settings.fbPixelId}
                  onChange={(e) => setSettings({ ...settings, fbPixelId: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="123456789012345"
                />
              </div>

              {/* Microsoft Clarity */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${clarityActive ? "bg-green-500" : "bg-amber-500"}`} />
                  <span className="text-sm font-medium">Microsoft Clarity</span>
                  <span className="text-xs text-muted-foreground">{clarityActive ? "Active" : "Not Configured"}</span>
                </div>
                <input
                  type="text"
                  value={settings.clarityId}
                  onChange={(e) => setSettings({ ...settings, clarityId: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="abcdef1234"
                />
              </div>

              {/* Hotjar */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${hotjarActive ? "bg-green-500" : "bg-amber-500"}`} />
                  <span className="text-sm font-medium">Hotjar</span>
                  <span className="text-xs text-muted-foreground">{hotjarActive ? "Active" : "Not Configured"}</span>
                </div>
                <input
                  type="text"
                  value={settings.hotjarId}
                  onChange={(e) => setSettings({ ...settings, hotjarId: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="1234567"
                />
              </div>

              {message && (
                <p className={`text-sm ${message.includes("success") ? "text-green-600" : "text-red-500"}`}>
                  {message}
                </p>
              )}

              <form onSubmit={handleSubmit}>
                <Button type="submit" disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Save Analytics Settings
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>View Reports</CardTitle>
              <CardDescription>Open your analytics dashboards.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <a
                href="https://analytics.google.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-retail hover:underline"
              >
                <ExternalLink className="w-4 h-4" />
                Open Google Analytics
              </a>
              <a
                href="https://business.facebook.com/events_manager"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-retail hover:underline"
              >
                <ExternalLink className="w-4 h-4" />
                Open Meta Events Manager
              </a>
              <a
                href="https://clarity.microsoft.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-retail hover:underline"
              >
                <ExternalLink className="w-4 h-4" />
                Open Microsoft Clarity
              </a>
              <a
                href="https://insights.hotjar.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-retail hover:underline"
              >
                <ExternalLink className="w-4 h-4" />
                Open Hotjar
              </a>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
