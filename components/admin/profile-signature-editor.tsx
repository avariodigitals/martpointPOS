"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Save } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { renderSignatureTemplate, type SignatureTemplate } from "@/lib/email-signature"

export function ProfileSignatureEditor({ initialSignature, initialTemplate, hasSavedTemplate, profilePhone, supportPhone }: {
  initialSignature: string; initialTemplate: SignatureTemplate; hasSavedTemplate: boolean
  profilePhone: string; supportPhone: boolean
}) {
  const router = useRouter()
  const [template, setTemplate] = useState(initialTemplate)
  const [phone, setPhone] = useState(profilePhone)
  const [custom, setCustom] = useState(Boolean(initialSignature && !hasSavedTemplate))
  const [saved, setSaved] = useState(hasSavedTemplate ? JSON.stringify([initialTemplate, profilePhone]) : "")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const signature = custom ? initialSignature : renderSignatureTemplate(template)
  const dirty = !custom && saved !== JSON.stringify([template, phone])

  function change(field: keyof SignatureTemplate, value: string) {
    setTemplate((current) => ({ ...current, [field]: value }))
    setNotice("")
  }

  async function save() {
    if (saving || !dirty) return
    setSaving(true); setError(""); setNotice("")
    try {
      const response = await fetch("/api/admin/profile/signature", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template, profilePhone: phone }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Could not save your signature")
      setTemplate(data.template); setSaved(JSON.stringify([data.template, phone]))
      setNotice("Signature saved. Your lead, partner, creator and support emails will use it automatically.")
      router.refresh()
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save your signature") }
    finally { setSaving(false) }
  }

  return <Card id="email-signature" className="rounded-2xl border-slate-200/80 shadow-sm">
    <CardHeader><CardTitle className="text-base">Email signature</CardTitle></CardHeader>
    <CardContent className="space-y-4">
      <p className="text-sm text-muted-foreground">Your template starts with your profile name, role, phone and email. Edit the plain text below; we format the HTML for outgoing emails. The company footer is added separately.</p>
      {custom ? <div className="space-y-3">
        <p className="text-sm">You have an existing custom signature. Switching to the profile template replaces it only after you save.</p>
        <Button type="button" variant="outline" onClick={() => setCustom(false)}>Use profile template</Button>
      </div> : <>
        <div className="grid gap-4 sm:grid-cols-2">
          {([['name', 'Name'], ['title', 'Role / job title'], ['email', 'Email'], ['company', 'Company']] as const).map(([field, label]) => <div key={field}>
            <label htmlFor={`signature-${field}`} className="mb-1 block text-sm font-medium">{label}</label>
            <input id={`signature-${field}`} type={field === 'email' ? 'email' : 'text'} value={template[field]}
              maxLength={field === 'email' ? 254 : 200} disabled={saving}
              onChange={(e) => change(field, e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
          </div>)}
          <div>
            <label htmlFor="profile-phone" className="mb-1 block text-sm font-medium">My profile phone</label>
            <input id="profile-phone" type="tel" value={phone} maxLength={60} disabled={saving}
              onChange={(e) => { setPhone(e.target.value); if (!supportPhone) change('phone', e.target.value) }}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            <p className="mt-1 text-xs text-muted-foreground">Saved to your user profile with your signature.</p>
          </div>
          {supportPhone && <div>
            <label htmlFor="signature-support-phone" className="mb-1 block text-sm font-medium">Support team phone</label>
            <input id="signature-support-phone" value={template.phone} readOnly className="w-full rounded-md border bg-muted px-3 py-2 text-sm" />
            <p className="mt-1 text-xs text-muted-foreground">Managed in Admin Settings → Contact → Support Phone Number. Your signature always uses the current team number.</p>
          </div>}
        </div>
        <div>
          <label htmlFor="signature-extra" className="mb-1 block text-sm font-medium">Additional details</label>
          <textarea id="signature-extra" value={template.extra} maxLength={2000} rows={3} disabled={saving}
            onChange={(e) => change('extra', e.target.value)} placeholder="Optional closing or additional contact details"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
        </div>
      </>}
      <div>
        <p className="mb-2 text-xs font-medium text-muted-foreground">Signature preview</p>
        <iframe title="Your email signature preview" sandbox="" className="h-52 w-full rounded-md border bg-white" srcDoc={`<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font:14px/1.6 Arial,sans-serif;color:#111827;padding:12px}img{max-width:100%;height:auto}a{color:#0057ff}</style></head><body>${signature}</body></html>`} />
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {notice && <p role="status" className="text-sm text-green-700">{notice}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={save} disabled={saving || !dirty || !template.name.trim()}>
          {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}Save signature
        </Button>
        {custom === false && initialSignature && !hasSavedTemplate && <Button type="button" variant="ghost" disabled={saving} onClick={() => setCustom(true)}>Keep existing signature</Button>}
      </div>
    </CardContent>
  </Card>
}
