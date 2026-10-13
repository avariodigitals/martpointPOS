"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, Plus, Trash2, X } from "lucide-react"
import { useToast } from "@/components/admin/admin-toast"
import { QuestionEditor, blankQuestion, findQuestionError } from "./question-editor"
import type {
  AssessmentQuestion,
  AssessmentTemplate,
  AssessmentTier,
  QuestionInput,
} from "@/lib/partner-assessments"

const INPUT = "rounded-md border border-input bg-background px-3 py-2 text-sm"

type TemplateDraft = Omit<AssessmentTemplate, "id"> & { id?: string }

const BLANK: TemplateDraft = {
  tierId: "",
  name: "",
  description: "",
  instructions: "",
  timeLimitMinutes: 20,
  passingScore: 70,
  conditionalScore: 50,
  maxAttempts: 3,
  shuffleQuestions: false,
  shuffleOptions: false,
  questionSampleCount: null,
  showResultImmediately: true,
  showCorrectAnswers: false,
  status: "DRAFT",
}

const STATUS_LABELS: Record<AssessmentTemplate["status"], string> = {
  DRAFT: "Draft — cannot be assigned",
  ACTIVE: "Active — can be assigned",
  ARCHIVED: "Archived",
}

function toInput(q: AssessmentQuestion): QuestionInput {
  return {
    id: q.id,
    prompt: q.prompt,
    type: q.type,
    options: q.options,
    correctKeys: q.correctKeys,
    acceptedKeywords: q.acceptedKeywords,
    keywordMode: q.keywordMode,
    points: q.points,
    requiresReview: q.requiresReview,
    explanation: q.explanation ?? "",
    helpText: q.helpText,
    required: q.required,
    sortOrder: q.sortOrder,
  }
}

export function TemplatePanel({
  tier,
  tierName,
  onReload,
}: {
  tier: AssessmentTier
  tierName: string
  onReload: () => void
}) {
  const { toast } = useToast()
  const [templates, setTemplates] = useState<AssessmentTemplate[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState<TemplateDraft | null>(null)
  const [questions, setQuestions] = useState<QuestionInput[]>([])
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  useEffect(() => {
    setDraft(null)
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tier.id])

  async function load() {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/partner-assessments/templates?tierId=${encodeURIComponent(tier.id)}`)
      const data = await res.json()
      setTemplates((data.templates || []) as AssessmentTemplate[])
      setCounts((data.questionCount || {}) as Record<string, number>)
    } finally {
      setLoading(false)
    }
  }

  async function openEditor(template: AssessmentTemplate) {
    const res = await fetch(`/api/admin/partner-assessments/templates/${encodeURIComponent(template.id)}`)
    const data = await res.json()
    if (!res.ok) {
      toast({ title: data.error || "Could not open the paper", variant: "error" })
      return
    }
    setDraft(data.template as TemplateDraft)
    setQuestions(((data.questions || []) as AssessmentQuestion[]).map(toInput))
  }

  async function save() {
    if (!draft) return
    if (!draft.name.trim()) {
      toast({ title: "Give the paper a name", variant: "warning" })
      return
    }
    if (draft.conditionalScore > draft.passingScore) {
      toast({ title: "The conditional band cannot sit above the pass band", variant: "warning" })
      return
    }
    const bad = findQuestionError(questions)
    if (bad) {
      toast({ title: bad.message, variant: "warning" })
      return
    }

    setSaving(true)
    try {
      // The paper must exist before its questions can be written to it.
      const settingsRes = await fetch(
        draft.id
          ? `/api/admin/partner-assessments/templates/${encodeURIComponent(draft.id)}`
          : "/api/admin/partner-assessments/templates",
        {
          method: draft.id ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(draft.id ? draft : { ...draft, tierId: tier.id }),
        }
      )
      const settings = await settingsRes.json().catch(() => ({}))
      if (!settingsRes.ok) {
        toast({ title: settings.error || "Could not save the paper", variant: "error" })
        return
      }
      const id = (settings.template as AssessmentTemplate).id

      const questionsRes = await fetch(`/api/admin/partner-assessments/templates/${encodeURIComponent(id)}/questions`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questions: questions.map((q, i) => ({
            ...q,
            options: q.options.filter((o) => o.text.trim()),
            sortOrder: i,
          })),
        }),
      })
      const savedQuestions = await questionsRes.json().catch(() => ({}))
      if (!questionsRes.ok) {
        toast({ title: savedQuestions.error || "Saved the settings but not the questions", variant: "error" })
        return
      }

      setDraft({ ...settings.template as TemplateDraft })
      setQuestions(((savedQuestions.questions || []) as AssessmentQuestion[]).map(toInput))
      toast({ title: "Paper saved", variant: "success" })
      await load()
      onReload()
    } finally {
      setSaving(false)
    }
  }

  async function remove(id: string) {
    const res = await fetch(`/api/admin/partner-assessments/templates/${encodeURIComponent(id)}`, { method: "DELETE" })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      toast({ title: data.error || "Could not delete the paper", variant: "error" })
      return
    }
    toast({ title: "Paper deleted", variant: "success" })
    setConfirmDelete(null)
    await load()
  }

  const editing = draft !== null

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-sm font-medium">Papers in {tierName}</CardTitle>
          <p className="text-xs text-muted-foreground">
            A tier can hold several editable papers. Only active ones can be assigned.
          </p>
        </div>
        {!editing && (
          <Button size="sm" onClick={() => { setDraft({ ...BLANK, tierId: tier.id }); setQuestions([blankQuestion()]) }}>
            <Plus className="w-3.5 h-3.5 mr-1" /> New paper
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {loading && <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />}

        {!loading && templates.length === 0 && !editing && (
          <p className="text-sm text-muted-foreground">No papers in this tier yet.</p>
        )}

        {!editing && templates.map((t) => (
          <div key={t.id} className="rounded-lg border border-border p-3 space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{t.name}</p>
                <p className="text-xs text-muted-foreground">
                  {counts[t.id] ?? 0} questions · {t.timeLimitMinutes} min · pass {t.passingScore}% · conditional {t.conditionalScore}% · {t.maxAttempts} attempts
                </p>
                <p className="text-xs text-muted-foreground">{STATUS_LABELS[t.status]}</p>
                {t.description && <p className="text-xs text-muted-foreground mt-1">{t.description}</p>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button size="sm" variant="outline" onClick={() => openEditor(t)}>Edit</Button>
                <button
                  onClick={() => setConfirmDelete(confirmDelete === t.id ? null : t.id)}
                  className="text-muted-foreground hover:text-red-600"
                  aria-label="Delete paper"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            {confirmDelete === t.id && (
              <div className="flex items-center justify-between gap-2 pt-2 border-t border-border">
                <p className="text-xs">Delete “{t.name}”? Papers already assigned cannot be deleted.</p>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={() => setConfirmDelete(null)}>Keep</Button>
                  <Button size="sm" onClick={() => remove(t.id)}>Delete</Button>
                </div>
              </div>
            )}
          </div>
        ))}

        {editing && draft && (
          <div className="rounded-lg border border-border p-3 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium">{draft.id ? "Edit paper" : "New paper"}</p>
              <button onClick={() => setDraft(null)} className="text-muted-foreground hover:text-foreground" aria-label="Close editor">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                placeholder="Paper name"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                className={INPUT}
              />
              <select
                value={draft.status}
                onChange={(e) => setDraft({ ...draft, status: e.target.value as AssessmentTemplate["status"] })}
                className={INPUT}
              >
                {(Object.keys(STATUS_LABELS) as AssessmentTemplate["status"][]).map((s) => (
                  <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                ))}
              </select>
            </div>
            <input
              placeholder="One line on what this paper covers"
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              className={`w-full ${INPUT}`}
            />

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <label className="text-xs space-y-1 block">
                <span className="text-muted-foreground">Minutes</span>
                <input
                  type="number" min={1} max={480} value={draft.timeLimitMinutes}
                  onChange={(e) => setDraft({ ...draft, timeLimitMinutes: Number(e.target.value) })}
                  className={`w-full ${INPUT}`}
                />
              </label>
              <label className="text-xs space-y-1 block">
                <span className="text-muted-foreground">Pass %</span>
                <input
                  type="number" min={0} max={100} value={draft.passingScore}
                  onChange={(e) => setDraft({ ...draft, passingScore: Number(e.target.value) })}
                  className={`w-full ${INPUT}`}
                />
              </label>
              <label className="text-xs space-y-1 block">
                <span className="text-muted-foreground">Conditional %</span>
                <input
                  type="number" min={0} max={100} value={draft.conditionalScore}
                  onChange={(e) => setDraft({ ...draft, conditionalScore: Number(e.target.value) })}
                  className={`w-full ${INPUT}`}
                />
              </label>
              <label className="text-xs space-y-1 block">
                <span className="text-muted-foreground">Attempts</span>
                <input
                  type="number" min={1} max={20} value={draft.maxAttempts}
                  onChange={(e) => setDraft({ ...draft, maxAttempts: Number(e.target.value) })}
                  className={`w-full ${INPUT}`}
                />
              </label>
            </div>

            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={draft.shuffleQuestions} onChange={(e) => setDraft({ ...draft, shuffleQuestions: e.target.checked })} />
                Shuffle questions
              </label>
              <label className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={draft.shuffleOptions} onChange={(e) => setDraft({ ...draft, shuffleOptions: e.target.checked })} />
                Shuffle options
              </label>
              <label className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={draft.showResultImmediately} onChange={(e) => setDraft({ ...draft, showResultImmediately: e.target.checked })} />
                Show result immediately
              </label>
              <label className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={draft.showCorrectAnswers} onChange={(e) => setDraft({ ...draft, showCorrectAnswers: e.target.checked })} />
                Reveal correct answers
              </label>
            </div>

            <textarea
              placeholder="Instructions shown on the cover screen, before the timer starts"
              value={draft.instructions}
              onChange={(e) => setDraft({ ...draft, instructions: e.target.value })}
              rows={2}
              className={`w-full ${INPUT}`}
            />

            <div className="space-y-3">
              <p className="text-xs font-medium">Questions</p>
              <QuestionEditor questions={questions} onChange={setQuestions} />
            </div>

            <div className="flex gap-2">
              <Button size="sm" onClick={save} disabled={saving}>
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
                Save paper
              </Button>
              <Button size="sm" variant="outline" onClick={() => setDraft(null)}>Close</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
