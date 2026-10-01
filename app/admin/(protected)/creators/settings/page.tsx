"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, Settings } from "lucide-react"

interface CreatorSettings {
  applicationsOpen: boolean
  autoAiReview: boolean
  requireOnboardingBeforeSubmissions: boolean
  minimumAge: number
}

function Toggle({
  label, hint, checked, onChange,
}: {
  label: string
  hint: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className="flex items-start justify-between gap-4 rounded-lg border p-4 cursor-pointer">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>
      </div>
      <input
        type="checkbox"
        className="mt-1 h-4 w-4"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  )
}

export default function CreatorSettingsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [settings, setSettings] = useState<CreatorSettings>({
    applicationsOpen: true,
    autoAiReview: true,
    requireOnboardingBeforeSubmissions: true,
    minimumAge: 18,
  })
  const [message, setMessage] = useState("")

  useEffect(() => {
    fetch("/api/admin/creators/settings")
      .then((r) => r.json())
      .then((d) => setSettings((s) => ({ ...s, ...d })))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function save() {
    setSaving(true)
    setMessage("")
    try {
      const res = await fetch("/api/admin/creators/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      })
      setMessage(res.ok ? "Settings saved." : "Failed to save.")
    } finally {
      setSaving(false)
      setTimeout(() => setMessage(""), 4000)
    }
  }

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Settings className="w-5 h-5" /> Creator Network Settings
        </h2>
        <p className="text-muted-foreground">Module behaviour for the Creator Network.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm">Applications</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Toggle
            label="Applications open"
            hint="Show the apply form on /creators/apply. Turn off to pause recruitment."
            checked={settings.applicationsOpen}
            onChange={(v) => setSettings((s) => ({ ...s, applicationsOpen: v }))}
          />
          <div className="rounded-lg border p-4">
            <label className="block text-sm font-medium mb-1">Minimum age</label>
            <input
              type="number" min={13} max={25}
              value={settings.minimumAge}
              onChange={(e) => setSettings((s) => ({ ...s, minimumAge: Number(e.target.value) }))}
              className="w-24 rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            <p className="text-xs text-muted-foreground mt-1">Applicants who provide a date of birth below this age are rejected at submit time.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Automation</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Toggle
            label="Automatic AI assessment"
            hint="Run the AI review automatically when a new application is submitted. Admins can always re-run it manually."
            checked={settings.autoAiReview}
            onChange={(v) => setSettings((s) => ({ ...s, autoAiReview: v }))}
          />
          <Toggle
            label="Require onboarding before submissions"
            hint="Creators must complete the onboarding sequence before content submissions are accepted."
            checked={settings.requireOnboardingBeforeSubmissions}
            onChange={(v) => setSettings((s) => ({ ...s, requireOnboardingBeforeSubmissions: v }))}
          />
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          Save Settings
        </Button>
        {message && <p className="text-sm text-muted-foreground">{message}</p>}
      </div>
    </div>
  )
}
