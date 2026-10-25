"use client"

import { useId } from "react"
import { Plus, Trash2 } from "lucide-react"
import { firstAvailableDepartmentDigit, type VoiceDepartmentForm } from "@/lib/voice-department-form"

const field = "block min-h-11 w-full min-w-0 max-w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"

export function VoiceDepartmentsEditor({ departments, menuEnabled, onChange, onMenuChange }: {
  departments: VoiceDepartmentForm[]
  menuEnabled: boolean
  onChange: (value: VoiceDepartmentForm[]) => void
  onMenuChange: (value: boolean) => void
}) {
  const prefix = useId()
  const nextDigit = firstAvailableDepartmentDigit(departments)
  function update(index: number, changes: Partial<VoiceDepartmentForm>) {
    onChange(departments.map((item, itemIndex) => itemIndex === index ? { ...item, ...changes } : item))
  }
  return <section aria-labelledby={`${prefix}-heading`} className="@container min-w-0 space-y-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5">
    <div className="space-y-2">
      <h3 id={`${prefix}-heading`} className="text-sm font-semibold text-slate-900">Department routing</h3>
      <p className="text-sm leading-6 text-slate-600">Choose which department answers each keypad option. The primary destination is tried first, followed by its backup destinations.</p>
      <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 text-sm font-medium text-slate-800">
        <input type="checkbox" checked={menuEnabled} onChange={(event) => onMenuChange(event.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-blue-600" />
        <span>Enable department menu<span className="mt-1 block text-xs font-normal leading-5 text-slate-500">Callers press 1–8 to choose a department. Pressing 9 repeats the menu.</span></span>
      </label>
    </div>
    <div className="grid min-w-0 gap-4 @3xl:grid-cols-2">
      {departments.map((department, index) => {
        const row = `${prefix}-${department.id || index}`
        return <fieldset key={department.id || index} className="m-0 min-w-0 space-y-4 rounded-xl border border-slate-200 bg-white p-4">
          <legend className="sr-only">Department {index + 1}</legend>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">{department.digit ? `Press ${department.digit}` : "Choose a digit"}</span>
            <span className={`text-xs font-medium ${department.enabled ? "text-emerald-700" : "text-slate-500"}`}>{department.enabled ? "Routing enabled" : "Routing disabled"}</span>
          </div>
          <div className="grid min-w-0 grid-cols-[5.5rem_minmax(0,1fr)] items-start gap-3">
            <div className="min-w-0 space-y-1.5"><label htmlFor={`${row}-digit`} className="block text-xs font-medium text-slate-700">Keypad digit</label><input id={`${row}-digit`} value={department.digit} inputMode="numeric" pattern="[1-8]" maxLength={1} autoComplete="off" placeholder="1" className={`${field} text-center`} onChange={(event) => update(index, { digit: event.target.value })} /></div>
            <div className="min-w-0 space-y-1.5"><label htmlFor={`${row}-name`} className="block text-xs font-medium text-slate-700">Department name</label><input id={`${row}-name`} value={department.label} placeholder="Sales and demos" className={field} onChange={(event) => update(index, { label: event.target.value })} /></div>
          </div>
          <div className="min-w-0 space-y-1.5"><label htmlFor={`${row}-primary`} className="block text-xs font-medium text-slate-700">Primary destination</label><input id={`${row}-primary`} value={department.primary} placeholder="+234… or a SIP address" autoComplete="off" spellCheck={false} className={field} onChange={(event) => update(index, { primary: event.target.value })} /><p className="text-xs leading-5 text-slate-500">Use an international phone number or an Africa&apos;s Talking SIP address.</p></div>
          <div className="min-w-0 space-y-1.5"><label htmlFor={`${row}-fallback`} className="block text-xs font-medium text-slate-700">Backup destinations <span className="font-normal text-slate-500">(optional)</span></label><textarea id={`${row}-fallback`} value={department.fallback} rows={2} placeholder="One destination per line" spellCheck={false} className={`${field} resize-y leading-6`} onChange={(event) => update(index, { fallback: event.target.value })} /><p className="text-xs leading-5 text-slate-500">Separate multiple backups with new lines or commas.</p></div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
            <label className="flex min-h-10 items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={department.enabled} onChange={(event) => update(index, { enabled: event.target.checked })} className="h-4 w-4 accent-blue-600" />Enable this department</label>
            <button type="button" onClick={() => onChange(departments.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Remove department ${index + 1}`} className="inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-medium text-red-700 hover:bg-red-50"><Trash2 className="h-4 w-4 shrink-0" />Remove</button>
          </div>
        </fieldset>
      })}
    </div>
    {departments.length === 0 && <p className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">No departments added yet. Add a department to set its keypad digit and call destination.</p>}
    <div className="flex flex-wrap items-center gap-3"><button type="button" disabled={nextDigit === null} onClick={() => {
      if (nextDigit !== null) onChange([...departments, { id: crypto.randomUUID(), digit: String(nextDigit), label: "", primary: "", fallback: "", enabled: true }])
    }} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-blue-200 bg-white px-4 text-sm font-semibold text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-40"><Plus className="h-4 w-4" />Add department</button><p className="text-xs text-slate-500">{nextDigit === null ? "All eight keypad options are in use." : "Up to eight departments. Digit 9 is reserved."}</p></div>
  </section>
}
