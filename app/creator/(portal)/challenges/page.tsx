import { requireCreatorSession } from "@/lib/creator-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { Card, CardContent } from "@/components/ui/card"
import { Trophy } from "lucide-react"

const STATUS_LABEL: Record<string, string> = {
  SCHEDULED: "Coming Soon",
  ACTIVE: "Active",
  SUBMISSION_CLOSED: "Submission Closed",
  JUDGING: "Judging",
  COMPLETED: "Completed",
}

export default async function CreatorChallengesPage() {
  await requireCreatorSession()

  const challenges = isSupabaseConfigured()
    ? (await supabase
        .from("creator_challenges")
        .select("id, name, slug, description, status, start_date, submission_deadline, performance_cutoff")
        .in("status", ["SCHEDULED", "ACTIVE", "SUBMISSION_CLOSED", "JUDGING", "COMPLETED"])
        .order("created_at", { ascending: false })
        .limit(50)).data || []
    : []

  return (
    <div className="space-y-6 max-w-4xl">
      <h2 className="text-2xl font-bold tracking-tight">Challenges</h2>
      {challenges.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Trophy className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="font-medium">No challenges yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              When MartPoint launches a creator challenge, it will appear here and you&apos;ll get a notification.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {challenges.map((c) => (
            <Card key={c.id}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold">{c.name}</p>
                    {c.description && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{c.description}</p>
                    )}
                    <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
                      {c.start_date && <span>Starts {new Date(c.start_date as string).toLocaleDateString("en-GB")}</span>}
                      {c.submission_deadline && <span>Deadline {new Date(c.submission_deadline as string).toLocaleDateString("en-GB")}</span>}
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs font-medium">
                    {STATUS_LABEL[c.status as string] || c.status}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
