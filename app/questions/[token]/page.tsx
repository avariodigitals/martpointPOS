"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { QuestionnaireFields, type QuestionnaireFormField } from "@/components/shared/questionnaire-fields"
import { Loader2, CheckCircle2 } from "lucide-react"

export default function AdditionalQuestionsPage() {
  const { token } = useParams<{ token: string }>()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const [title, setTitle] = useState("Additional Questions")
  const [lead, setLead] = useState<{ fullName: string; businessName: string } | null>(null)
  const [fields, setFields] = useState<QuestionnaireFormField[]>([])
  const [responses, setResponses] = useState<Record<string, unknown>>({})

  useEffect(() => {
    fetch(`/api/questions/${token}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setError(data.error)
        } else {
          setLead(data.lead)
          setTitle(data.title || "Additional Questions")
          setFields(data.fields || [])
          setResponses(data.responses || {})
          if (data.status === "Submitted" || data.status === "Reviewed") setSubmitted(true)
        }
      })
      .catch(() => setError("Failed to load questions"))
      .finally(() => setLoading(false))
  }, [token])

  const update = (name: string, value: unknown) => {
    setResponses((prev) => ({ ...prev, [name]: value }))
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError("")
    try {
      const res = await fetch(`/api/questions/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ responses }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Failed to submit answers")
      } else {
        setSubmitted(true)
      }
    } catch {
      setError("Failed to submit answers")
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
            <p className="text-muted-foreground">Your answers for {lead?.businessName} have been submitted. We will be in touch shortly.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-muted/30 py-10 px-4">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="text-lg">{title}</CardTitle>
          {lead && <p className="text-sm text-muted-foreground">For {lead.businessName} · {lead.fullName}</p>}
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <QuestionnaireFields fields={fields} responses={responses} onChange={update} />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" disabled={saving} className="w-full">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Submit Answers
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
