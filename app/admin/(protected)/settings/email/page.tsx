"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, Save, Mail, ArrowLeft } from "lucide-react"

interface EmailSettingsForm {
  resendApiKey: string
  fromEmail: string
  notifyEmail: string
}

export default function EmailSettingsPage() {
  const [settings, setSettings] = useState<EmailSettingsForm>({
    resendApiKey: "",
    fromEmail: "",
    notifyEmail: "",
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")

  useEffect(() => {
    fetch("/api/admin/settings", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (data.email) {
          setSettings({
            resendApiKey: data.email.resendApiKey || "",
            fromEmail: data.email.fromEmail || "",
            notifyEmail: data.email.notifyEmail || "",
          })
        }
      })
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMessage("")

    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: settings }),
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
              <CardTitle>Resend Configuration</CardTitle>
              <CardDescription>
                These settings are stored in the database and override environment variables when present.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
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
                  Format: <code className="text-xs bg-muted px-1 py-0.5 rounded">Display Name &lt;email@domain.com&gt;</code>. The domain must be verified in Resend.
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
        </form>
      )}
    </div>
  )
}
