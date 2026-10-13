"use client"

import { useParams } from "next/navigation"
import { AssessmentRunner } from "@/components/partner/assessment-runner"

export default function PublicAssessmentPage() {
  const { token } = useParams<{ token: string }>()
  if (!token) return null
  return (
    <AssessmentRunner
      loadUrl={`/api/partners/assessment/${token}`}
      startUrl={`/api/partners/assessment/${token}/start`}
      submitUrl={`/api/partners/assessment/${token}/submit`}
    />
  )
}
