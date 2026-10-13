import { NextResponse } from "next/server"
import { authorizePartner, getPartnerSession } from "@/lib/partner-auth"
import { listAssignments } from "@/lib/partner-assessments"

export async function GET() {
  const session = await getPartnerSession()
  const auth = await authorizePartner({ session, permission: "partner:resources:view" })
  if (auth.response) return auth.response

  const assignments = await listAssignments({ partnerId: auth.partner!.id, audience: "PARTNER" })
  return NextResponse.json({
    assignments: assignments.map((a) => ({
      id: a.id,
      templateName: a.template.name,
      tierName: a.tier.name,
      description: a.template.description,
      instructions: a.template.instructions,
      timeLimitMinutes: a.template.timeLimitMinutes,
      passingScore: a.template.passingScore,
      conditionalScore: a.template.conditionalScore,
      maxAttempts: a.template.maxAttempts,
      attemptsUsed: a.attemptsUsed,
      attemptsLeft: Math.max(0, a.template.maxAttempts - a.attemptsUsed),
      status: a.status,
      dueAt: a.dueAt,
      bestPercent: a.bestPercent,
      finalOutcome: a.finalOutcome,
      waivedReason: a.waivedReason,
      assignedByName: a.assignedByName,
      assignedAt: a.assignedAt,
      canStart: a.status === "PENDING" && a.attemptsUsed < a.template.maxAttempts,
    })),
  })
}
