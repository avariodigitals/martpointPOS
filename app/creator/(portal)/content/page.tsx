import { requireCreatorSession } from "@/lib/creator-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { Card, CardContent } from "@/components/ui/card"
import { FileVideo } from "lucide-react"

const STATUS_LABEL: Record<string, string> = {
  SUBMITTED: "Submitted",
  UNDER_REVIEW: "Under Review",
  APPROVED: "Approved",
  NEEDS_CORRECTION: "Needs Correction",
  REJECTED: "Rejected",
  DISQUALIFIED: "Disqualified",
}

const STATUS_CLASS: Record<string, string> = {
  APPROVED: "bg-green-100 text-green-700",
  SUBMITTED: "bg-blue-100 text-blue-700",
  UNDER_REVIEW: "bg-amber-100 text-amber-700",
  NEEDS_CORRECTION: "bg-orange-100 text-orange-700",
  REJECTED: "bg-red-100 text-red-700",
  DISQUALIFIED: "bg-red-100 text-red-700",
}

export default async function CreatorContentPage() {
  const { creator } = await requireCreatorSession()

  const submissions = isSupabaseConfigured()
    ? (await supabase
        .from("creator_submissions")
        .select("id, platform, content_url, caption, status, review_feedback, submitted_at, creator_challenges(name)")
        .eq("creator_id", creator.id)
        .order("submitted_at", { ascending: false })
        .limit(100)).data || []
    : []

  return (
    <div className="space-y-6 max-w-4xl">
      <h2 className="text-2xl font-bold tracking-tight">My Content</h2>
      {submissions.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <FileVideo className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="font-medium">No submissions yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Join an active challenge and submit your published content URLs here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {submissions.map((s) => {
            const challenge = s.creator_challenges as { name?: string } | null
            return (
              <Card key={s.id}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-sm">{challenge?.name || "General submission"}</p>
                      <a
                        href={s.content_url as string}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-retail hover:underline break-all"
                      >
                        {s.content_url}
                      </a>
                      {s.review_feedback && (
                        <p className="text-xs text-muted-foreground mt-2 border-l-2 border-muted pl-2">
                          {s.review_feedback}
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_CLASS[s.status as string] || "bg-muted"}`}>
                        {STATUS_LABEL[s.status as string] || s.status}
                      </span>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        {new Date(s.submitted_at as string).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
