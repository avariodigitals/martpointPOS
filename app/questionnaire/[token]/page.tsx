"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, CheckCircle2 } from "lucide-react"

interface QuestionnaireField {
  name: string
  label: string
  type: string
  options?: string[]
  optionStatuses?: Record<string, string>
  required?: boolean
  default?: string | number | boolean
  helpText?: string
}

export default function QuestionnairePage() {
  const { token } = useParams<{ token: string }>()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const [lead, setLead] = useState<{ fullName: string; businessName: string } | null>(null)
  const [fields, setFields] = useState<QuestionnaireField[]>([])
  const [responses, setResponses] = useState<Record<string, unknown>>({})

  useEffect(() => {
    fetch(`/api/questionnaire/${token}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setError(data.error)
        } else {
          setLead(data.lead)
          setFields(data.fields || [])
          setResponses(data.responses || {})
          if (data.status === "Submitted" || data.status === "Reviewed") setSubmitted(true)
        }
      })
      .catch(() => setError("Failed to load questionnaire"))
      .finally(() => setLoading(false))
  }, [token])

  const update = (name: string, value: unknown) => {
    setResponses((prev) => ({ ...prev, [name]: value }))
  }

  const toggleMulti = (name: string, option: string) => {
    setResponses((prev) => {
      const current = Array.isArray(prev[name]) ? (prev[name] as string[]) : []
      return { ...prev, [name]: current.includes(option) ? current.filter((o) => o !== option) : [...current, option] }
    })
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError("")
    try {
      const res = await fetch(`/api/questionnaire/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ responses }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Failed to submit")
      } else {
        setSubmitted(true)
      }
    } catch {
      setError("Failed to submit questionnaire")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error && !lead) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center text-red-600">{error}</CardContent>
        </Card>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center space-y-3">
            <CheckCircle2 className="w-10 h-10 text-green-600 mx-auto" />
            <h2 className="text-lg font-semibold">Thank you, {lead?.fullName}</h2>
            <p className="text-muted-foreground">Your questionnaire for {lead?.businessName} has been submitted. We will be in touch with a tailored quote.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-muted/30 py-10 px-4">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="text-lg">MartPoint Requirements Questionnaire</CardTitle>
          {lead && <p className="text-sm text-muted-foreground">For {lead.businessName} · {lead.fullName}</p>}
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            {fields.map((field) => (
              field.type === "section" ? (
                <div key={field.name} className="pt-4 mt-2 border-t border-border">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">{field.label}</h3>
                  {field.helpText && <p className="text-xs text-muted-foreground mt-1">{field.helpText}</p>}
                </div>
              ) : (
              <div key={field.name}>
                <label className="block text-sm font-medium mb-1">
                  {field.label} {field.required && <span className="text-red-500">*</span>}
                </label>
                {field.helpText && <p className="text-xs text-muted-foreground mb-1.5">{field.helpText}</p>}
                {field.type === "textarea" ? (
                  <textarea
                    required={field.required}
                    value={String(responses[field.name] ?? "")}
                    onChange={(e) => update(field.name, e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px]"
                  />
                ) : field.type === "multiselect" ? (
                  <div className="rounded-md border border-input bg-background px-3 py-2 space-y-1.5">
                    {field.options?.map((o) => {
                      const selected = Array.isArray(responses[field.name]) && (responses[field.name] as string[]).includes(o)
                      const status = field.optionStatuses?.[o]
                      return (
                        <label key={o} className="flex items-center gap-2 text-sm cursor-pointer py-0.5">
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => toggleMulti(field.name, o)}
                            className="rounded border-input shrink-0"
                          />
                          <span className="flex-1">{o}</span>
                          {status === "coming-soon" && (
                            <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">
                              Coming soon
                            </span>
                          )}
                          {status === "ready" && (
                            <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">
                              Ready
                            </span>
                          )}
                        </label>
                      )
                    })}
                  </div>
                ) : field.type === "select" ? (
                  <select
                    required={field.required}
                    value={String(responses[field.name] ?? (field.default || ""))}
                    onChange={(e) => update(field.name, e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">Select...</option>
                    {field.options?.map((o) => (
                      <option key={o} value={o}>
                        {o}{field.optionStatuses?.[o] === "coming-soon" ? " (Coming soon)" : ""}
                      </option>
                    ))}
                  </select>
                ) : field.type === "boolean" ? (
                  <select
                    required={field.required}
                    value={String(responses[field.name] ?? (field.default ? "Yes" : "No"))}
                    onChange={(e) => update(field.name, e.target.value === "Yes")}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">Select...</option>
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                  </select>
                ) : (
                  <input
                    type={field.type === "number" ? "number" : field.type === "date" ? "date" : field.type === "email" ? "email" : field.type === "tel" ? "tel" : "text"}
                    required={field.required}
                    value={String(responses[field.name] ?? (field.default || ""))}
                    onChange={(e) => update(field.name, field.type === "number" ? Number(e.target.value) : e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                )}
              </div>
            )))}
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" disabled={saving} className="w-full">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Submit Questionnaire
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
