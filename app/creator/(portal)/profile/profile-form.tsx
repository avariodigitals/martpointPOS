"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"

const inputCls = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm"

export function ProfileForm({
  initial,
}: {
  initial: { phone: string; whatsapp: string; state: string; city: string; bio: string }
}) {
  const [form, setForm] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setMessage(null)
    try {
      const res = await fetch("/api/creator/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      setMessage(res.ok ? { ok: true, text: "Profile updated." } : { ok: false, text: data.error || "Failed to save." })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-sm font-medium">Contact & Bio</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={save} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1">Phone</label>
              <input className={inputCls} value={form.phone} onChange={set("phone")} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">WhatsApp</label>
              <input className={inputCls} value={form.whatsapp} onChange={set("whatsapp")} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">State</label>
              <input className={inputCls} value={form.state} onChange={set("state")} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">City</label>
              <input className={inputCls} value={form.city} onChange={set("city")} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Bio</label>
            <textarea className={inputCls} rows={3} value={form.bio} onChange={set("bio")} />
          </div>
          {message && <p className={`text-sm ${message.ok ? "text-green-600" : "text-red-500"}`}>{message.text}</p>}
          <Button type="submit" size="sm" disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Save Changes
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
