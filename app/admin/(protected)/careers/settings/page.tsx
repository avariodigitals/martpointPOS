"use client"

import { useCallback, useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, Plus, Settings } from "lucide-react"
import { DEFAULT_APPLICATION_CONFIRMATION, CONFIRMATION_MESSAGE_VARS } from "@/lib/careers"

interface Lookup { id: string; name: string; description: string | null; active: boolean; sort_order: number }

export default function CareersSettingsPage() {
  const [loading, setLoading] = useState(true)
  const [departments, setDepartments] = useState<Lookup[]>([])
  const [categories, setCategories] = useState<Lookup[]>([])
  const [settings, setSettings] = useState<Record<string, unknown>>({})
  const [newName, setNewName] = useState<Record<"department" | "category", string>>({ department: "", category: "" })
  const [confirmMsg, setConfirmMsg] = useState(DEFAULT_APPLICATION_CONFIRMATION)
  const [savingMsg, setSavingMsg] = useState(false)
  const [msg, setMsg] = useState("")

  const load = useCallback(() => {
    fetch("/api/admin/careers/settings").then((r) => r.json()).then((d) => {
      setDepartments(d.departments || [])
      setCategories(d.categories || [])
      setSettings(d.settings || {})
      if (typeof d.settings?.default_confirmation_message === "string" && d.settings.default_confirmation_message.trim()) {
        setConfirmMsg(d.settings.default_confirmation_message)
      }
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  useEffect(load, [load])

  async function post(body: Record<string, unknown>) {
    setMsg("")
    const res = await fetch("/api/admin/careers/settings", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    })
    const d = await res.json()
    setMsg(res.ok ? "Saved." : d.error || "Failed")
    if (res.ok) load()
  }

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>

  const renderLookupEditor = (title: string, type: "department" | "category", items: Lookup[]) => (
    <Card key={type}>
      <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {items.map((i) => (
          <div key={i.id} className="flex items-center justify-between text-sm border-b border-border pb-2 last:border-0">
            <span className={i.active ? "" : "text-muted-foreground line-through"}>{i.name}</span>
            <Button size="sm" variant="ghost" onClick={() => post({ type, id: i.id, name: i.name, active: !i.active, sort_order: i.sort_order })}>
              {i.active ? "Disable" : "Enable"}
            </Button>
          </div>
        ))}
        <div className="flex gap-2 pt-2">
          <input className="rounded-md border border-input bg-background px-3 py-1.5 text-sm flex-1"
            placeholder={`New ${type}…`} value={newName[type]}
            onChange={(e) => setNewName((n) => ({ ...n, [type]: e.target.value }))} />
          <Button size="sm" variant="outline" disabled={!newName[type].trim()}
            onClick={() => { post({ type, name: newName[type].trim() }); setNewName((n) => ({ ...n, [type]: "" })) }}>
            <Plus className="w-3.5 h-3.5" /> Add
          </Button>
        </div>
      </CardContent>
    </Card>
  )

  const notifSetting = (settings.email_notifications || {}) as Record<string, unknown>

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2"><Settings className="w-5 h-5" /> Careers Settings</h2>
        <p className="text-muted-foreground">Departments, job categories and careers configuration.</p>
      </div>
      {msg && <p className="text-xs text-muted-foreground">{msg}</p>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {renderLookupEditor("Departments", "department", departments)}
        {renderLookupEditor("Job categories", "category", categories)}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Default confirmation message</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Sent to applicants after they submit — shown on the post-submit screen and inside the
            &quot;application received&quot; email. A vacancy can override this with its own message.
            Placeholders: {CONFIRMATION_MESSAGE_VARS.map((v) => `{{${v}}}`).join(", ")}
          </p>
          <textarea
            rows={12}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono text-xs"
            value={confirmMsg}
            onChange={(e) => setConfirmMsg(e.target.value)}
          />
          <div className="flex gap-2">
            <Button size="sm" disabled={savingMsg} onClick={async () => {
              setSavingMsg(true)
              await post({ type: "setting", key: "default_confirmation_message", value: confirmMsg })
              setSavingMsg(false)
            }}>
              {savingMsg ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null} Save message
            </Button>
            <Button size="sm" variant="outline" onClick={() => setConfirmMsg(DEFAULT_APPLICATION_CONFIRMATION)}>
              Reset to built-in template
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Notifications</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="accent-retail"
              checked={notifSetting.enabled !== false}
              onChange={(e) => post({ type: "setting", key: "email_notifications", value: { ...notifSetting, enabled: e.target.checked } })} />
            Email notifications enabled
          </label>
          <p className="text-xs text-muted-foreground">
            Careers emails (application received, shortlisted, assessment invite, selection, reserve, rejection, deployment invite/reminder)
            are sent via the existing email service. WhatsApp sending can be added when a provider is configured.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
