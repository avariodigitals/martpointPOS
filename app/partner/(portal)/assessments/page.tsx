import { redirect } from "next/navigation"
import Link from "next/link"
import { requirePartnerSession, authorizePartner } from "@/lib/partner-auth"
import { listAssignments, OUTCOME_LABELS } from "@/lib/partner-assessments"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ClipboardCheck, Clock } from "lucide-react"
import { enumLabel } from "@/lib/utils"

export default async function PartnerAssessmentsPage() {
  const session = await requirePartnerSession()
  const auth = await authorizePartner({ session, permission: "partner:resources:view" })
  if (!auth.authorized) redirect("/partner")

  const assignments = await listAssignments({ partnerId: auth.partner!.id, audience: "PARTNER" })

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <ClipboardCheck className="w-6 h-6" /> Knowledge Assessments
        </h2>
        <p className="text-muted-foreground">
          Papers the MartPoint team has set for you. Each one is timed and marked as soon as you submit.
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm font-medium">Your papers</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {assignments.length === 0 && (
            <p className="text-sm text-muted-foreground">Nothing is assigned to you right now.</p>
          )}
          {assignments.map((a) => {
            const open = a.status === "PENDING" || a.status === "IN_PROGRESS"
            return (
              <div key={a.id} className="rounded-xl border border-border p-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{a.template.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{a.tier.name}</p>
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {a.template.timeLimitMinutes} min · pass {a.template.passingScore}% · conditional {a.template.conditionalScore}%
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {a.attemptsUsed} of {a.template.maxAttempts} attempts used
                    {a.dueAt && ` · due ${new Date(a.dueAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`}
                    {a.waivedReason && ` · waived: ${a.waivedReason}`}
                  </p>
                  {a.bestPercent !== null && (
                    <p className="text-xs mt-1">
                      Best score {a.bestPercent}%{a.finalOutcome ? ` · ${OUTCOME_LABELS[a.finalOutcome]}` : ""}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <span className={`text-[10px] uppercase px-2 py-0.5 rounded-full font-medium ${
                    a.status === "GRADED" ? "bg-green-100 text-green-700"
                    : a.status === "SUBMITTED" ? "bg-blue-100 text-blue-700"
                    : a.status === "EXPIRED" ? "bg-red-100 text-red-700"
                    : "bg-muted text-muted-foreground"
                  }`}>
                    {enumLabel(a.status)}
                  </span>
                  {open && (
                    <Link href={`/partner/assessments/${a.id}`}>
                      <Button size="sm">{a.status === "IN_PROGRESS" ? "Continue" : "Start"}</Button>
                    </Link>
                  )}
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Something looks wrong with a paper? Raise a support ticket and the Partner Team can reset or waive it.
      </p>
    </div>
  )
}
