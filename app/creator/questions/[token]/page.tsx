"use client"

import { useEffect, useRef, useState } from "react"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { QuestionnaireFormField } from "@/components/shared/questionnaire-fields"
import { CheckCircle2, Loader2, Paperclip, X } from "lucide-react"

const FILE_ACCEPT = ".pdf,.png,.jpg,.jpeg,.webp"
const MAX_FILE_BYTES = 5 * 1024 * 1024

function formatSize(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`
}

export default function CreatorApplicationQuestionsPage() {
  const { token } = useParams<{ token: string }>()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [title, setTitle] = useState("Additional Questions")
  const [applicant, setApplicant] = useState<{ fullName: string; reference: string | null } | null>(null)
  const [fields, setFields] = useState<QuestionnaireFormField[]>([])
  const [responses, setResponses] = useState<Record<string, unknown>>({})
  const [files, setFiles] = useState<Record<string, File[]>>({})
  const [fileErrors, setFileErrors] = useState<Record<string, string>>({})
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    fetch(`/api/creator/questions/${token}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error)
        else {
          setTitle(data.title || "Additional Questions")
          setApplicant(data.applicant)
          setFields((data.fields || []) as QuestionnaireFormField[])
          setResponses(data.responses || {})
          setSubmitted(data.status !== "Sent")
        }
      })
      .catch(() => setError("Could not load these questions."))
      .finally(() => setLoading(false))
  }, [token])

  const setValue = (name: string, value: unknown) => setResponses((c) => ({ ...c, [name]: value }))
  const toggleMulti = (name: string, option: string) => {
    const current = Array.isArray(responses[name]) ? (responses[name] as string[]) : []
    setValue(name, current.includes(option) ? current.filter((o) => o !== option) : [...current, option])
  }

  function addFiles(name: string, incoming: FileList | null) {
    if (!incoming?.length) return
    const picked: File[] = []
    const errors: string[] = []
    for (const file of Array.from(incoming)) {
      if (file.size > MAX_FILE_BYTES) errors.push(`${file.name} is larger than 5 MB`)
      else picked.push(file)
    }
    setFiles((c) => {
      const merged = [...(c[name] || [])]
      for (const f of picked) if (!merged.some((m) => m.name === f.name && m.size === f.size)) merged.push(f)
      return { ...c, [name]: merged.slice(0, 5) }
    })
    setFileErrors((c) => ({ ...c, [name]: errors.join("; ") }))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError("")
    try {
      const form = new FormData()
      const textResponses: Record<string, unknown> = {}
      for (const field of fields) if (field.type !== "file") textResponses[field.name] = responses[field.name]
      form.append("responses", JSON.stringify(textResponses))
      for (const field of fields) {
        if (field.type !== "file") continue
        for (const file of files[field.name] || []) form.append(`file_${field.name}`, file)
      }
      const res = await fetch(`/api/creator/questions/${token}`, { method: "POST", body: form })
      const data = await res.json()
      if (!res.ok) setError(data.error || "Could not submit answers")
      else setSubmitted(true)
    } catch {
      setError("Could not submit answers")
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin" /></div>

  const renderField = (field: QuestionnaireFormField) => {
    if (field.type === "section") {
      return (
        <div key={field.name} className="pt-4 mt-2 border-t border-border">
          <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">{field.label}</h3>
          {field.helpText && <p className="text-xs text-muted-foreground mt-1">{field.helpText}</p>}
        </div>
      )
    }
    return (
      <div key={field.name}>
        <label className="block text-sm font-medium mb-1">
          {field.label} {field.required && <span className="text-red-500">*</span>}
        </label>
        {field.helpText && <p className="text-xs text-muted-foreground mb-1.5">{field.helpText}</p>}
        {field.type === "textarea" ? (
          <textarea
            required={field.required}
            value={String(responses[field.name] ?? "")}
            onChange={(e) => setValue(field.name, e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px]"
          />
        ) : field.type === "multiselect" ? (
          <div className="rounded-md border border-input bg-background px-3 py-2 space-y-1.5">
            {field.options?.map((o) => (
              <label key={o} className="flex items-center gap-2 text-sm cursor-pointer py-0.5">
                <input type="checkbox" checked={Array.isArray(responses[field.name]) && (responses[field.name] as string[]).includes(o)} onChange={() => toggleMulti(field.name, o)} className="rounded border-input shrink-0" />
                <span>{o}</span>
              </label>
            ))}
          </div>
        ) : field.type === "select" ? (
          <select required={field.required} value={String(responses[field.name] ?? (field.default as string || ""))} onChange={(e) => setValue(field.name, e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
            <option value="">Select...</option>
            {field.options?.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        ) : field.type === "boolean" ? (
          <select required={field.required} value={String(responses[field.name] ?? "")} onChange={(e) => setValue(field.name, e.target.value === "Yes")} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
            <option value="">Select...</option>
            <option value="Yes">Yes</option>
            <option value="No">No</option>
          </select>
        ) : field.type === "file" ? (
          <div className="rounded-md border border-dashed border-input bg-background px-3 py-3 space-y-2">
            <input
              type="file" multiple accept={FILE_ACCEPT}
              onChange={(e) => { addFiles(field.name, e.target.files); e.target.value = "" }}
              className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary-foreground"
            />
            {(files[field.name] || []).length > 0 && (
              <ul className="space-y-1">
                {files[field.name].map((f, i) => (
                  <li key={`${f.name}-${i}`} className="flex items-center gap-2 text-xs bg-muted rounded px-2 py-1">
                    <Paperclip className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate flex-1">{f.name}</span>
                    <span className="text-muted-foreground shrink-0">{formatSize(f.size)}</span>
                    <button type="button" aria-label={`Remove ${f.name}`} onClick={() => setFiles((c) => ({ ...c, [field.name]: (c[field.name] || []).filter((_, j) => j !== i) }))} className="text-muted-foreground hover:text-foreground">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {fileErrors[field.name] && <p className="text-xs text-red-600">{fileErrors[field.name]}</p>}
          </div>
        ) : (
          <input
            type={field.type === "number" ? "number" : field.type === "date" ? "date" : field.type === "email" ? "email" : field.type === "tel" ? "tel" : "text"}
            required={field.required}
            value={String(responses[field.name] ?? (field.default as string || ""))}
            onChange={(e) => setValue(field.name, field.type === "number" ? Number(e.target.value) : e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        )}
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-muted/30 py-10 px-4 flex items-center justify-center">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          {applicant && <p className="text-sm text-muted-foreground">MartPoint Creator Network{applicant.reference ? ` · application ${applicant.reference}` : ""} — for {applicant.fullName}</p>}
        </CardHeader>
        <CardContent>
          {submitted ? (
            <div className="py-6 text-center space-y-3">
              <CheckCircle2 className="w-10 h-10 text-green-600 mx-auto" />
              <h2 className="font-semibold">Thank you, {applicant?.fullName || "there"}</h2>
              <p className="text-sm text-muted-foreground">Your answers have been submitted to the MartPoint Creator Network team.</p>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              {fields.map(renderField)}
              {error && <p className="text-sm text-red-600">{error}</p>}
              <Button type="submit" disabled={saving} className="w-full">{saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}Submit Answers</Button>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  )
}
