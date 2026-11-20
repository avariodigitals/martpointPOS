"use client"

import { Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react"
import type { GrowthQuestion } from "@/lib/business-growth-policy"

const field = "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
const label = "block text-sm font-medium text-slate-700"

function nextQuestionId(questions: GrowthQuestion[]) {
  const used = new Set(questions.map((question) => question.id))
  let index = questions.length + 1
  while (used.has(`question_${index}`)) index++
  return `question_${index}`
}

export function GrowthQuestionnaireEditor({ questions, onChange }: { questions: GrowthQuestion[]; onChange: (questions: GrowthQuestion[]) => void }) {
  function update(index: number, changes: Partial<GrowthQuestion>) {
    onChange(questions.map((question, current) => current === index ? { ...question, ...changes } : question))
  }

  function move(index: number, offset: -1 | 1) {
    const target = index + offset
    if (target < 0 || target >= questions.length) return
    const reordered = [...questions]
    ;[reordered[index], reordered[target]] = [reordered[target], reordered[index]]
    onChange(reordered)
  }

  function add() {
    if (questions.length >= 40) return
    onChange([...questions, { id: nextQuestionId(questions), label: "New application question", type: "textarea", required: true, maxLength: 1200 }])
  }

  return <section className="sm:col-span-2 space-y-3" aria-label="Application questionnaire">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div><h3 className="text-sm font-semibold text-slate-900">Application questions</h3><p className="text-xs text-slate-500">Edit the seeded questions directly. Add at least 5 and no more than 40.</p></div>
      <button type="button" disabled={questions.length >= 40} onClick={add} className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium disabled:opacity-50"><Plus className="h-3.5 w-3.5" />Add question</button>
    </div>
    <div className="space-y-3">
      {questions.map((question, index) => <article key={index} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="mb-3 flex items-center justify-between gap-2"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Question {index + 1}</p><div className="flex items-center gap-1"><button type="button" disabled={index === 0} onClick={() => move(index, -1)} aria-label={`Move question ${index + 1} up`} className="rounded border bg-white p-1.5 disabled:opacity-40"><ArrowUp className="h-3.5 w-3.5" /></button><button type="button" disabled={index === questions.length - 1} onClick={() => move(index, 1)} aria-label={`Move question ${index + 1} down`} className="rounded border bg-white p-1.5 disabled:opacity-40"><ArrowDown className="h-3.5 w-3.5" /></button><button type="button" disabled={questions.length <= 5} onClick={() => onChange(questions.filter((_, current) => current !== index))} aria-label={`Delete question ${index + 1}`} className="rounded border border-red-200 bg-white p-1.5 text-red-700 disabled:opacity-40"><Trash2 className="h-3.5 w-3.5" /></button></div></div>
        <div className="grid gap-3 md:grid-cols-2">
          <label className={label}>Question wording<textarea required minLength={8} maxLength={500} rows={2} className={field} value={question.label} onChange={(event) => update(index, { label: event.target.value })} /></label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={label}>Answer type<select className={field} value={question.type} onChange={(event) => {
              const type = event.target.value as GrowthQuestion["type"]
              update(index, type === "select" ? { type, options: question.options?.length ? question.options : ["Option 1", "Option 2"] } : { type, options: undefined })
            }}><option value="text">Short text</option><option value="textarea">Long text</option><option value="select">Choose from options</option></select></label>
            <label className={label}>Question ID<input required pattern="[a-z][a-z0-9_]{1,49}" title="Start with a lowercase letter; use lowercase letters, numbers or underscores." className={field} value={question.id} onChange={(event) => update(index, { id: event.target.value })} /></label>
            <label className={`${label} flex items-center gap-2`}><input type="checkbox" checked={question.required} onChange={(event) => update(index, { required: event.target.checked })} />Required question</label>
            {question.type !== "select" && <label className={label}>Maximum answer length<input type="number" min={1} max={5000} className={field} value={question.maxLength || 2500} onChange={(event) => update(index, { maxLength: Number(event.target.value) })} /></label>}
          </div>
          {question.type === "select" && <label className={`${label} md:col-span-2`}>Answer options <span className="font-normal text-slate-500">(one per line, 2–20)</span><textarea required rows={4} className={`${field} font-mono text-xs`} value={(question.options || []).join("\n")} onChange={(event) => update(index, { options: event.target.value.split("\n").map((option) => option.trim()).filter(Boolean) })} /></label>}
        </div>
      </article>)}
    </div>
    <p className="text-xs text-slate-500">{questions.length} / 40 questions · question IDs must be unique and start with a lowercase letter.</p>
  </section>
}
