import Link from "next/link"
import { requireCreatorSession } from "@/lib/creator-auth"
import { listCreatorNotifications, markCreatorNotificationsRead } from "@/lib/creator-notifications"
import { Card, CardContent } from "@/components/ui/card"
import { Bell } from "lucide-react"

export default async function CreatorNotificationsPage() {
  const { creator } = await requireCreatorSession()
  const notifications = await listCreatorNotifications(creator.id, 100)
  await markCreatorNotificationsRead(creator.id)

  return (
    <div className="space-y-6 max-w-3xl">
      <h2 className="text-2xl font-bold tracking-tight">Notifications</h2>
      {notifications.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Bell className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No notifications yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => (
            <Card key={n.id} className={n.readAt ? "opacity-75" : ""}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-sm">{n.title}</p>
                    {n.body && <p className="text-sm text-muted-foreground mt-1">{n.body}</p>}
                    {n.link && (
                      <Link href={n.link} className="text-xs text-retail hover:underline mt-1 inline-block">
                        View →
                      </Link>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground shrink-0">
                    {new Date(n.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
