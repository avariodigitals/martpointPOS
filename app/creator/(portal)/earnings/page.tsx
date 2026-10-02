import { requireCreatorSession } from "@/lib/creator-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { REWARD_STATUSES } from "@/lib/creators"
import { Card, CardContent } from "@/components/ui/card"
import { Wallet } from "lucide-react"

const LABEL: Record<string, string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  PROCESSING: "Processing",
  PAID: "Paid",
  CANCELLED: "Cancelled",
}

const CLASS: Record<string, string> = {
  PAID: "bg-green-100 text-green-700",
  APPROVED: "bg-blue-100 text-blue-700",
  PROCESSING: "bg-amber-100 text-amber-700",
  PENDING: "bg-muted text-muted-foreground",
  CANCELLED: "bg-red-100 text-red-700",
}

function naira(kobo: number): string {
  return `₦${(kobo / 100).toLocaleString("en-NG")}`
}

export default async function CreatorEarningsPage() {
  const { creator } = await requireCreatorSession()

  const rewards = isSupabaseConfigured()
    ? (await supabase
        .from("creator_rewards")
        .select("id, title, description, source, amount_kobo, non_cash_reward, status, paid_at, created_at, creator_challenges(name)")
        .eq("creator_id", creator.id)
        .in("status", [...REWARD_STATUSES])
        .order("created_at", { ascending: false })
        .limit(100)).data || []
    : []

  return (
    <div className="space-y-6 max-w-3xl">
      <h2 className="text-2xl font-bold tracking-tight">Earnings &amp; Rewards</h2>
      {rewards.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Wallet className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="font-medium">No rewards yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Challenge rewards and bonuses appear here. Rewards follow the published terms of each
              challenge.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {rewards.map((r) => (
            <Card key={r.id}>
              <CardContent className="p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-sm">{r.title}</p>
                  {r.creator_challenges && <p className="text-[11px] text-retail">{(r.creator_challenges as { name?: string }).name}</p>}
                  {r.non_cash_reward && <p className="text-xs text-muted-foreground mt-0.5">+ {r.non_cash_reward as string}</p>}
                  {r.description && <p className="text-xs text-muted-foreground mt-0.5">{r.description}</p>}
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {r.paid_at
                      ? `Paid ${new Date(r.paid_at as string).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`
                      : new Date(r.created_at as string).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold">{naira((r.amount_kobo as number) || 0)}</p>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${CLASS[r.status as string] || "bg-muted"}`}>
                    {LABEL[r.status as string] || r.status}
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
