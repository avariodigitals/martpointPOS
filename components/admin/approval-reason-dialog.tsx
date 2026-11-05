"use client"

import { useCallback, useRef, useState } from "react"
import { ClipboardCheck, X } from "lucide-react"
import { Button } from "@/components/ui/button"

type DialogState = { title: string; description: string; reason: string }

function ApprovalReasonDialog({
  state,
  onChange,
  onCancel,
  onSubmit,
}: {
  state: DialogState | null
  onChange: (reason: string) => void
  onCancel: () => void
  onSubmit: () => void
}) {
  if (!state) return null
  const valid = state.reason.trim().length >= 5

  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel() }}>
    <section role="dialog" aria-modal="true" aria-labelledby="approval-reason-title" className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
      <div className="flex items-start gap-4 border-b border-slate-100 bg-gradient-to-br from-indigo-50 via-white to-white p-6">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700"><ClipboardCheck className="h-5 w-5" /></div>
        <div className="min-w-0 flex-1"><h2 id="approval-reason-title" className="text-lg font-semibold tracking-tight text-slate-900">{state.title}</h2><p className="mt-1 text-sm leading-5 text-slate-600">{state.description}</p></div>
        <button type="button" onClick={onCancel} aria-label="Close" className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white hover:text-slate-700"><X className="h-4 w-4" /></button>
      </div>
      <div className="space-y-2 p-6">
        <label htmlFor="approval-reason-input" className="text-sm font-medium text-slate-800">Reason for approval <span className="text-red-600">*</span></label>
        <textarea id="approval-reason-input" autoFocus value={state.reason} onChange={(event) => onChange(event.target.value)} rows={4} maxLength={1000} placeholder="Explain why this action is needed…" className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100" />
        <div className="flex items-center justify-between text-xs text-slate-500"><span>Enter at least 5 characters.</span><span>{state.reason.length}/1000</span></div>
      </div>
      <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50/70 px-6 py-4">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={onSubmit} disabled={!valid} className="bg-indigo-600 text-white hover:bg-indigo-700">Send for approval</Button>
      </div>
    </section>
  </div>
}

export function useApprovalReasonDialog() {
  const [state, setState] = useState<DialogState | null>(null)
  const resolver = useRef<((value: string | null) => void) | null>(null)

  const requestReason = useCallback((title: string, description: string) => new Promise<string | null>((resolve) => {
    resolver.current = resolve
    setState({ title, description, reason: "" })
  }), [])

  const finish = useCallback((value: string | null) => {
    const resolve = resolver.current
    resolver.current = null
    setState(null)
    resolve?.(value)
  }, [])

  const dialog = <ApprovalReasonDialog
    state={state}
    onChange={(reason) => setState((current) => current ? { ...current, reason } : current)}
    onCancel={() => finish(null)}
    onSubmit={() => finish(state?.reason.trim() || null)}
  />

  return { requestReason, dialog }
}
