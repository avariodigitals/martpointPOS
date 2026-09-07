"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, Save, Mail, ArrowLeft, RotateCcw } from "lucide-react"

interface TemplateDef {
  key: string
  label: string
  description: string
  variables: string[]
  defaultSubject: string
  defaultText: string
  subject: string
  text: string
}

export default function EmailTemplatesPage() {
  const [defs, setDefs] = useState<TemplateDef[]>([])
  const [templates, setTemplates] = useState<Record<string, { subject: string; text: string }>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")

  useEffect(() => {
    fetch("/api/admin/email-templates", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        const list = (data.templates || []) as TemplateDef[]
        setDefs(list)
        const merged: Record<string, { subject: string; text: string }> = {}
        for (const d of list) merged[d.key] = { subject: d.subject, text: d.text }
        setTemplates(merged)
      })
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMessage("")
    try {
      // The settings API shallow-merges top-level keys, so re-send the full
      // email object to avoid wiping routes/keys saved elsewhere.
      const settingsRes = await fetch("/api/admin/settings", { cache: "no-store" })
      const settings = await settingsRes.json()
      const currentEmail = (settings.email as Record<string, unknown> | undefined) || {}

      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: { ...currentEmail, templates } }),
      })
      const data = await res.json()
      setMessage(res.ok && data.success ? "Email templates saved." : data.error || "Failed to save templates.")
    } catch {
      setMessage("Network error. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/settings" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Settings
        </Link>
        <h2 className="text-2xl font-bold tracking-tight mt-2 flex items-center gap-2">
          <Mail className="w-5 h-5" /> Email Templates
        </h2>
        <p className="text-muted-foreground">
          Edit the emails the system sends. Use {"{{variable}}"} placeholders — the available variables are listed under each template.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {defs.map((def) => {
          const t = templates[def.key] || { subject: def.subject, text: def.text }
          const modified = t.subject !== def.defaultSubject || t.text !== def.defaultText
          return (
            <Card key={def.key}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">{def.label}</CardTitle>
                    <CardDescription>{def.description}</CardDescription>
                  </div>
                  {modified && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setTemplates((prev) => ({ ...prev, [def.key]: { subject: def.defaultSubject, text: def.defaultText } }))}
                    >
                      <RotateCcw className="w-3.5 h-3.5 mr-1" /> Reset to default
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Subject</label>
                  <input
                    type="text"
                    value={t.subject}
                    onChange={(e) => setTemplates((prev) => ({ ...prev, [def.key]: { ...prev[def.key], subject: e.target.value } }))}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Body (plain text)</label>
                  <textarea
                    rows={10}
                    value={t.text}
                    onChange={(e) => setTemplates((prev) => ({ ...prev, [def.key]: { ...prev[def.key], text: e.target.value } }))}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Variables: {def.variables.map((v) => `{{${v}}}`).join("  ")}
                </p>
              </CardContent>
            </Card>
          )
        })}

        {message && (
          <p className={`text-sm ${message.includes("saved") ? "text-green-600" : "text-red-600"}`}>{message}</p>
        )}

        <Card>
          <CardFooter className="flex items-center justify-end pt-6">
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save Templates
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  )
}
