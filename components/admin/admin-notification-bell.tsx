"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Bell, CheckCheck, ExternalLink, Loader2 } from "lucide-react"
import { readableRoleText } from "@/lib/utils"

interface Notification {
  id: string
  type: string
  title: string
  message?: string | null
  deep_link?: string | null
  created_at: string
}

function relativeTime(value: string) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000))
  if (seconds < 60) return "just now"
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

export function AdminNotificationBell() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unread, setUnread] = useState(0)
  const [loading, setLoading] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  async function load() {
    setLoading(true)
    try {
      const response = await fetch("/api/admin/notifications", { cache: "no-store" })
      const json = await response.json()
      setNotifications(json.notifications || [])
      setUnread(json.unread || 0)
    } catch {
      // Notifications should never disrupt the admin workspace.
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const initial = window.setTimeout(() => void load(), 0)
    const interval = window.setInterval(() => void load(), 15000)
    return () => {
      window.clearTimeout(initial)
      window.clearInterval(interval)
    }
  }, [])

  useEffect(() => {
    function close(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", close)
    return () => document.removeEventListener("mousedown", close)
  }, [])

  async function markRead(id?: string) {
    await fetch("/api/admin/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(id ? { id } : { all: true }),
    })
    if (id) {
      setNotifications((current) => current.filter((item) => item.id !== id))
      setUnread((current) => Math.max(0, current - 1))
    } else {
      setNotifications([])
      setUnread(0)
    }
  }

  function linkFor(item: Notification): string | null {
    if (item.deep_link?.startsWith("/")) {
      // Older quote alerts used the generic page URL. Keep those alerts useful
      // by taking the reviewer to the request queue rather than a blank/default
      // tab or a stale destination.
      if (item.type === "PARTNER_QUOTE_REQUEST_SUBMITTED" && item.deep_link === "/admin/partners/quotes") {
        return "/admin/partners/quotes?tab=requests"
      }
      return item.deep_link
    }
    if (item.type === "PARTNER_QUOTE_REQUEST_SUBMITTED") return "/admin/partners/quotes?tab=requests"
    return null
  }

  function openNotification(item: Notification) {
    const link = linkFor(item)
    if (!link) return
    setOpen(false)
    void markRead(item.id)
    router.push(link)
  }

  return (
    <div ref={rootRef} className="relative">
      <button type="button" onClick={() => setOpen((value) => !value)} aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`} aria-expanded={open} className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900">
        <Bell className="h-4 w-4" />
        {unread > 0 && <span className="absolute -right-1 -top-1 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white ring-2 ring-background">{unread > 99 ? "99+" : unread}</span>}
      </button>

      {open && <div className="absolute right-0 top-12 z-[80] w-[min(380px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.18)]">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3"><div><p className="text-sm font-semibold text-slate-900">Pending work</p><p className="text-xs text-muted-foreground">Items that may need your attention</p></div>{unread > 0 && <button type="button" onClick={() => void markRead()} className="inline-flex items-center gap-1 text-xs font-medium text-retail hover:underline"><CheckCheck className="h-3.5 w-3.5" /> Mark all read</button>}</div>
        <div className="max-h-[420px] overflow-y-auto">
          {loading && notifications.length === 0 ? <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div> : notifications.length === 0 ? <div className="px-6 py-12 text-center"><Bell className="mx-auto mb-3 h-8 w-8 text-slate-300" /><p className="text-sm font-medium text-slate-700">You’re all caught up</p><p className="mt-1 text-xs text-muted-foreground">New chats, tickets, and requests will appear here.</p></div> : notifications.map((item) => { const link = linkFor(item); return <div key={item.id} className="group flex gap-3 border-b border-slate-100 px-4 py-3 last:border-0 hover:bg-slate-50"><span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-retail" /><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><p className="text-sm font-medium text-slate-800">{readableRoleText(item.title)}</p><span className="shrink-0 text-[10px] text-slate-400">{relativeTime(item.created_at)}</span></div>{item.message && <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{readableRoleText(item.message)}</p>}<div className="mt-2 flex items-center gap-3"><button type="button" onClick={() => void markRead(item.id)} className="text-[11px] font-medium text-slate-500 hover:text-slate-900">Dismiss</button>{link && <button type="button" onClick={() => openNotification(item)} className="inline-flex items-center gap-1 text-[11px] font-semibold text-retail hover:underline">Open <ExternalLink className="h-3 w-3" /></button>}</div></div></div> })}
        </div>
      </div>}
    </div>
  )
}
