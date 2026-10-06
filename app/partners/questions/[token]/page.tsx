"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { QuestionnaireFields, type QuestionnaireFormField } from "@/components/shared/questionnaire-fields"
import { CheckCircle2, Loader2 } from "lucide-react"

export default function PartnerApplicationQuestionsPage() {
  const { token } = useParams<{ token: string }>()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [title, setTitle] = useState("Additional Questions")
  const [applicant, setApplicant] = useState<{ fullName: string; businessName: string } | null>(null)
  const [fields, setFields] = useState<QuestionnaireFormField[]>([])
  const [responses, setResponses] = useState<Record<string, unknown>>({})
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    fetch(`/api/partners/questions/${token}`).then((r) => r.json()).then((data) => {
      if (data.error) setError(data.error)
      else {
        setTitle(data.title || "Additional Questions")
        setApplicant(data.applicant)
        setFields(data.fields || [])
        setResponses(data.responses || {})
        setSubmitted(data.status !== "Sent")
      }
    }).catch(() => setError("Could not load these questions.")).finally(() => setLoading(false))
  }, [token])

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError("")
    try {
      const res = await fetch(`/api/partners/questions/${token}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ responses }) })
      const data = await res.json()
      if (!res.ok) setError(data.error || "Could not submit answers")
      else setSubmitted(true)
    } catch { setError("Could not submit answers") } finally { setSaving(false) }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin" /></div>
  return <main className="min-h-screen bg-muted/30 py-10 px-4 flex items-center justify-center">
    <Card className="w-full max-w-2xl">
      <CardHeader><CardTitle>{title}</CardTitle>{applicant && <p className="text-sm text-muted-foreground">For {applicant.businessName} · {applicant.fullName}</p>}</CardHeader>
      <CardContent>
        {submitted ? <div className="py-6 text-center space-y-3"><CheckCircle2 className="w-10 h-10 text-green-600 mx-auto" /><h2 className="font-semibold">Thank you, {applicant?.fullName || "there"}</h2><p className="text-sm text-muted-foreground">Your answers have been submitted to the MartPoint Partner Team.</p></div> :
          <form onSubmit={submit} className="space-y-4"><QuestionnaireFields fields={fields} responses={responses} onChange={(name, value) => setResponses((current) => ({ ...current, [name]: value }))} />{error && <p className="text-sm text-red-600">{error}</p>}<Button type="submit" disabled={saving} className="w-full">{saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}Submit Answers</Button></form>}
        {error && !applicant && <p className="text-sm text-red-600">{error}</p>}
      </CardContent>
    </Card>
  </main>
}
