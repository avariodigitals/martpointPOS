"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react"
import {
  ASSESSMENT_QUESTION_TYPES,
  OBJECTIVE_TYPES,
  QUESTION_TYPE_LABELS,
  TEXT_TYPES,
  type AssessmentOption,
  type AssessmentQuestionType,
  type QuestionInput,
} from "@/lib/partner-assessments"

const INPUT = "rounded-md border border-input bg-background px-3 py-2 text-sm"

function nextKey(options: AssessmentOption[]): string {
  const used = new Set(options.map((o) => o.key))
  for (const k of ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"]) {
    if (!used.has(k)) return k
  }
  return `O${options.length + 1}`
}

export function blankQuestion(): QuestionInput {
  return {
    prompt: "",
    type: "SINGLE",
    options: [
      { key: "A", text: "" },
      { key: "B", text: "" },
    ],
    correctKeys: [],
    acceptedKeywords: [],
    keywordMode: "ANY",
    points: 1,
    requiresReview: false,
    explanation: "",
    helpText: "",
    required: true,
  }
}

/** Returns the first invalid question and why, so the editor can open it. */
export function findQuestionError(rows: QuestionInput[]): { index: number; message: string } | null {
  for (let i = 0; i < rows.length; i++) {
    const q = rows[i]
    if (!q.prompt.trim()) return { index: i, message: `Question ${i + 1} has no text` }
    if (!OBJECTIVE_TYPES.includes(q.type)) continue
    if (q.options.filter((o) => o.text.trim()).length < 2) {
      return { index: i, message: `Question ${i + 1} needs at least two filled options` }
    }
    if (q.correctKeys.length === 0) {
      return { index: i, message: `Question ${i + 1} has no correct answer marked` }
    }
  }
  return null
}

export function QuestionEditor({
  questions,
  onChange,
}: {
  questions: QuestionInput[]
  onChange: (next: QuestionInput[]) => void
}) {
  const [open, setOpen] = useState<number | null>(0)
  const rows = questions

  function patch(index: number, changes: Partial<QuestionInput>) {
    onChange(rows.map((q, i) => (i === index ? { ...q, ...changes } : q)))
  }

  function changeType(index: number, type: AssessmentQuestionType) {
    const q = rows[index]
    if (type === "TRUE_FALSE") {
      patch(index, {
        type,
        options: [{ key: "TRUE", text: "True" }, { key: "FALSE", text: "False" }],
        correctKeys: [],
        acceptedKeywords: [],
      })
      return
    }
    if (TEXT_TYPES.includes(type)) {
      patch(index, { type, options: [], correctKeys: [], requiresReview: q.acceptedKeywords.length === 0 })
      return
    }
    const options = q.options.length >= 2
      ? q.options
      : [{ key: "A", text: "" }, { key: "B", text: "" }]
    patch(index, { type, options, acceptedKeywords: [] })
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= rows.length) return
    const next = [...rows]
    const [item] = next.splice(index, 1)
    next.splice(target, 0, item)
    onChange(next)
    setOpen(target)
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Applicants never see the marked answers, keywords or explanations — those stay in here.
      </p>

      {rows.length === 0 && (
        <p className="text-sm text-muted-foreground">No questions yet. Add the first one below.</p>
      )}

      {rows.map((q, i) => {
        const isOpen = open === i
        const objective = OBJECTIVE_TYPES.includes(q.type)
        const summary = q.prompt.trim() || `Question ${i + 1}`
        return (
          <div key={`${q.id ?? "new"}-${i}`} className="rounded-lg border border-border">
            <div className="flex items-center gap-2 p-3">
              <button onClick={() => setOpen(isOpen ? null : i)} className="text-muted-foreground hover:text-foreground" aria-label="Toggle question">
                {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
              </button>
              <span className="text-xs text-muted-foreground w-5">{i + 1}</span>
              <p className="text-sm font-medium truncate flex-1">{summary}</p>
              <span className="text-xs text-muted-foreground shrink-0">
                {QUESTION_TYPE_LABELS[q.type]} · {q.points} pt{q.points === 1 ? "" : "s"}
              </span>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => move(i, -1)} disabled={i === 0} className="text-muted-foreground hover:text-foreground disabled:opacity-30" aria-label="Move up">
                  <ChevronUp className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => move(i, 1)} disabled={i === rows.length - 1} className="text-muted-foreground hover:text-foreground disabled:opacity-30" aria-label="Move down">
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => { onChange(rows.filter((_, k) => k !== i)); setOpen(null) }}
                  className="text-muted-foreground hover:text-red-600"
                  aria-label="Remove question"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {isOpen && (
              <div className="border-t border-border p-3 space-y-3">
                <textarea
                  value={q.prompt}
                  onChange={(e) => patch(i, { prompt: e.target.value })}
                  placeholder="Question wording"
                  rows={2}
                  className={`w-full ${INPUT}`}
                />
                <input
                  value={q.helpText}
                  onChange={(e) => patch(i, { helpText: e.target.value })}
                  placeholder="Optional hint shown under the question"
                  className={`w-full ${INPUT}`}
                />

                <div className="flex flex-wrap items-center gap-3">
                  <select
                    value={q.type}
                    onChange={(e) => changeType(i, e.target.value as AssessmentQuestionType)}
                    className={INPUT}
                  >
                    {ASSESSMENT_QUESTION_TYPES.map((t) => (
                      <option key={t} value={t}>{QUESTION_TYPE_LABELS[t]}</option>
                    ))}
                  </select>
                  <label className="flex items-center gap-2 text-xs">
                    Points
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={q.points}
                      onChange={(e) => patch(i, { points: Number(e.target.value) })}
                      className={`w-16 ${INPUT}`}
                    />
                  </label>
                  <label className="flex items-center gap-2 text-xs">
                    <input type="checkbox" checked={q.required} onChange={(e) => patch(i, { required: e.target.checked })} />
                    Must be answered
                  </label>
                </div>

                {objective && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium">Options — tick the correct one{q.type === "MULTI" ? "s" : ""}</p>
                    {q.options.map((opt, oi) => (
                      <div key={oi} className="flex items-center gap-2">
                        <input
                          type={q.type === "MULTI" ? "checkbox" : "radio"}
                          name={`correct-${i}`}
                          checked={q.correctKeys.includes(opt.key)}
                          onChange={(e) => {
                            const correctKeys = q.type === "MULTI"
                              ? (e.target.checked ? [...q.correctKeys, opt.key] : q.correctKeys.filter((k) => k !== opt.key))
                              : [opt.key]
                            patch(i, { correctKeys })
                          }}
                        />
                        <span className="text-xs text-muted-foreground w-5">{opt.key}</span>
                        <input
                          value={opt.text}
                          placeholder={`Option ${opt.key}`}
                          onChange={(e) => patch(i, {
                            options: q.options.map((o, k) => (k === oi ? { ...o, text: e.target.value } : o)),
                          })}
                          className={`flex-1 ${INPUT}`}
                        />
                        <button
                          onClick={() => patch(i, {
                            options: q.options.filter((_, k) => k !== oi),
                            correctKeys: q.correctKeys.filter((k) => k !== opt.key),
                          })}
                          disabled={q.options.length <= 2 || q.type === "TRUE_FALSE"}
                          className="text-muted-foreground hover:text-red-600 disabled:opacity-30"
                          aria-label="Remove option"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                    {q.type !== "TRUE_FALSE" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => patch(i, { options: [...q.options, { key: nextKey(q.options), text: "" }] })}
                      >
                        <Plus className="w-3.5 h-3.5 mr-1" /> Add option
                      </Button>
                    )}
                  </div>
                )}

                {TEXT_TYPES.includes(q.type) && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium">Keywords that auto-mark the answer</p>
                    <input
                      value={q.acceptedKeywords.join(", ")}
                      onChange={(e) => patch(i, {
                        acceptedKeywords: e.target.value.split(",").map((k) => k.trim()).filter(Boolean),
                        requiresReview: e.target.value.trim() === "" ? true : q.requiresReview,
                      })}
                      placeholder="renewal, month-end, commission"
                      className={`w-full ${INPUT}`}
                    />
                    <div className="flex flex-wrap items-center gap-3">
                      <select
                        value={q.keywordMode}
                        onChange={(e) => patch(i, { keywordMode: e.target.value as "ANY" | "ALL" })}
                        className={INPUT}
                      >
                        <option value="ANY">Any keyword matches</option>
                        <option value="ALL">All keywords required</option>
                      </select>
                      <label className="flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={q.requiresReview}
                          onChange={(e) => patch(i, { requiresReview: e.target.checked })}
                        />
                        Always send to the review queue
                      </label>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {q.acceptedKeywords.length === 0
                        ? "No keywords, so every answer lands in the review queue for a person to mark."
                        : q.requiresReview
                          ? "Answers are marked automatically and still reviewed by a person before the result counts."
                          : "Answers matching the keywords pass without a person; the rest go to the review queue."}
                    </p>
                  </div>
                )}

                <textarea
                  value={q.explanation || ""}
                  onChange={(e) => patch(i, { explanation: e.target.value })}
                  placeholder="Explanation (optional) — shown back to the applicant only if the paper allows it"
                  rows={2}
                  className={`w-full ${INPUT}`}
                />
              </div>
            )}
          </div>
        )
      })}

      <Button size="sm" variant="outline" onClick={() => { onChange([...rows, blankQuestion()]); setOpen(rows.length) }}>
        <Plus className="w-3.5 h-3.5 mr-1" /> Add question
      </Button>
    </div>
  )
}
