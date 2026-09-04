"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Bell, Check, Loader2 } from "lucide-react"
import Link from "next/link"

type Notification = {
  id: string
  title: string
  message: string | null
  deep_link: string | null
  is_read: boolean
  type: string
  created_at: string
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)

  const load = async () => {
    setLoading(true)
    const res = await fetch("/api/admin/notifications")
    const data = await res.json()
    if (data.success) setNotifications(data.notifications || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const markRead = async (id: string) => {
    setWorking(true)
    await fetch("/api/admin/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark_read", notificationId: id }),
    })
    setWorking(false)
    load()
  }

  const markAllRead = async () => {
    setWorking(true)
    await fetch("/api/admin/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark_all_read" }),
    })
    setWorking(false)
    load()
  }

  const unreadCount = notifications.filter((n) => !n.is_read).length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Notifications</h2>
          <p className="text-muted-foreground">Operational events across the platform.</p>
        </div>
        <Button size="sm" onClick={markAllRead} disabled={working || unreadCount === 0}>
          {working ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4 mr-1" />}
          Mark all read
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">{unreadCount} unread</p>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Bell className="w-4 h-4 text-muted-foreground" />
            Notification centre
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading...
            </div>
          ) : notifications.length === 0 ? (
            <p className="text-sm text-muted-foreground">No notifications.</p>
          ) : (
            <div className="space-y-2">
              {notifications.map((n) => (
                <div
                  key={n.id}
                  className={`flex items-start justify-between p-3 rounded-md border ${n.is_read ? "bg-muted/20 border-border" : "bg-muted/40 border-retail/30"}`}
                >
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium flex items-center gap-2">
                      {n.title}
                      {!n.is_read && <span className="w-2 h-2 rounded-full bg-retail" />}
                    </p>
                    {n.message && <p className="text-xs text-muted-foreground">{n.message}</p>}
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{n.type} · {new Date(n.created_at).toLocaleString()}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {n.deep_link && (
                      <Link href={n.deep_link} className="text-xs text-retail hover:underline">
                        Open
                      </Link>
                    )}
                    {!n.is_read && (
                      <Button size="sm" variant="ghost" onClick={() => markRead(n.id)} disabled={working}>
                        <Check className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
