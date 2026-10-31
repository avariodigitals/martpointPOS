"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Loader2, Save } from "lucide-react"
import { emailDraftSchema, emailDraftSavePayload, emailDraftUnchanged, type SavedEmailDraft, type EmailDraft, type EmailDraftKind } from "@/lib/email-drafts"

export function useEmailDraft(kind: EmailDraftKind, entityId: string) {
  const [saved, setSaved] = useState<SavedEmailDraft | null>(null)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadedUrl, setLoadedUrl] = useState("")
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const url = `/api/admin/email-drafts/${kind}/${entityId}`
  useEffect(() => {
    const controller = new AbortController()
    fetch(url, { signal: controller.signal, cache: "no-store" }).then(async (response) => {
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Could not load saved draft")
      if (!controller.signal.aborted) {
        setError(""); setNotice("")
        const parsed = emailDraftSchema.safeParse(data.saved?.draft)
        setSaved(parsed.success ? { draft: parsed.data, updatedAt: data.saved.updatedAt } : null)
      }
    }).catch((cause) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Could not load draft") })
      .finally(() => { if (!controller.signal.aborted) { setLoading(false); setLoadedUrl(url) } })
    return () => controller.abort()
  }, [url])

  async function save(draft: EmailDraft) {
    setBusy(true); setError(""); setNotice("")
    try {
      const currentSaved = loadedUrl === url ? saved : null
      if (emailDraftUnchanged(draft, currentSaved)) {
        setNotice("This draft is already saved to your account.")
        return
      }
      const response = await fetch(url, { method: "PUT", headers: { "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify(emailDraftSavePayload(draft, currentSaved)) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Could not save draft")
      setSaved({ draft: { ...draft, bodyHtml: data.saved.bodyHtml }, updatedAt: data.saved.updatedAt })
      setNotice("Draft saved to your account, including attachments. Use Restore draft to continue later.")
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save draft") }
    finally { setBusy(false) }
  }
  async function remove() {
    if (!saved) return
    setBusy(true); setError(""); setNotice("")
    try {
      const response = await fetch(url, { method: "DELETE" })
      if (!response.ok) { const data = await response.json(); throw new Error(data.error || "Could not delete saved draft") }
      setSaved(null)
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not delete saved draft") }
    finally { setBusy(false) }
  }
  return { saved: loadedUrl === url ? saved : null, busy, loading: loading || loadedUrl !== url, error: loadedUrl === url ? error : "", notice: loadedUrl === url ? notice : "", save, remove }
}

export function EmailDraftControls({ manager, getDraft, onRestore, disabled = false }: {
  manager: ReturnType<typeof useEmailDraft>; getDraft: () => EmailDraft; onRestore: (draft: EmailDraft) => void; disabled?: boolean
}) {
  return <div className="space-y-2 rounded-md border border-dashed p-3">
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" variant="outline" size="sm" disabled={disabled || manager.busy || manager.loading} onClick={() => void manager.save(getDraft())}>
        {manager.busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}{manager.busy ? "Saving draft…" : "Save draft"}
      </Button>
      {manager.saved && <>
        <Button type="button" variant="outline" size="sm" disabled={disabled || manager.busy} onClick={() => onRestore(manager.saved!.draft)}>Restore draft</Button>
        <Button type="button" variant="ghost" size="sm" disabled={disabled || manager.busy} onClick={() => void manager.remove()}>Delete saved draft</Button>
        <span className="text-xs text-muted-foreground">Saved {new Date(manager.saved.updatedAt).toLocaleString("en-GB")}</span>
      </>}
    </div>
    {manager.error && <p role="alert" className="text-xs text-destructive">{manager.error}</p>}
    {manager.notice && <p role="status" className="text-xs text-muted-foreground">{manager.notice}</p>}
  </div>
}
