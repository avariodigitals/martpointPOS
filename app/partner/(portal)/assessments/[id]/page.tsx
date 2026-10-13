"use client"

import { useParams, useRouter } from "next/navigation"
import { AssessmentRunner } from "@/components/partner/assessment-runner"

export default function PartnerAssessmentTakePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  if (!id) return null
  return (
    <AssessmentRunner
      loadUrl={`/api/partner/assessments/${id}`}
      startUrl={`/api/partner/assessments/${id}/start`}
      submitUrl={`/api/partner/assessments/${id}`}
      onBack={() => router.push("/partner/assessments")}
      wide
    />
  )
}
