"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Bell, CheckCheck, ExternalLink, Loader2 } from "lucide-react"

interface PortalNotification {
  id: string
  type: string
  title: string
  body?: string | null
  link?: string | null
  readAt?: string | null
  createdAt: string
}

function relativeTime(value: string) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000))
  if (seconds < 60) return "just now"
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

export function PortalNotificationBell({ endpoint, variant = "dark" }: { endpoint: string; variant?: "dark" | "light" }) {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<PortalNotification[]>([])
  const [unread, setUnread] = useState(0)
  const [loading, setLoading] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(endpoint, { cache: "no-store" })
      if (!response.ok) return
      const json = await response.json()
      setNotifications(json.notifications || [])
      setUnread(Number(json.unread || 0))
    } catch {
      // A notification failure must never interrupt portal work.
    } finally {
      setLoading(false)
    }
  }, [endpoint])

  useEffect(() => {
    const initial = window.setTimeout(() => void load(), 0)
    const interval = window.setInterval(() => void load(), 15000)
    return () => {
      window.clearTimeout(initial)
      window.clearInterval(interval)
    }
  }, [load])

  useEffect(() => {
    function close(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", close)
    return () => document.removeEventListener("mousedown", close)
  }, [])

  async function markRead(id?: string) {
    await fetch(endpoint, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(id ? { id } : { all: true }),
    }).catch(() => undefined)
    if (id) {
      setNotifications((current) => current.map((item) => item.id === id ? { ...item, readAt: new Date().toISOString() } : item))
      setUnread((current) => Math.max(0, current - 1))
    } else {
      setNotifications((current) => current.map((item) => ({ ...item, readAt: item.readAt || new Date().toISOString() })))
      setUnread(0)
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
        aria-expanded={open}
        className={`relative flex h-9 w-9 items-center justify-center rounded-xl border transition ${
          variant === "light"
            ? "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-950"
            : "border-white/15 bg-white/10 text-white/85 hover:bg-white/20 hover:text-white"
        }`}
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && <span className={`absolute -right-1 -top-1 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white ${variant === "light" ? "ring-2 ring-white" : "ring-2 ring-[#0A0F1C]"}`}>{unread > 99 ? "99+" : unread}</span>}
      </button>

      {open && <div className="absolute right-0 top-11 z-[80] w-[min(380px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-[0_24px_70px_rgba(15,23,42,0.25)]">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <div><p className="text-sm font-semibold">Notifications</p><p className="text-xs text-slate-500">Updates from MartPoint</p></div>
          {unread > 0 && <button type="button" onClick={() => void markRead()} className="inline-flex items-center gap-1 text-xs font-medium text-retail hover:underline"><CheckCheck className="h-3.5 w-3.5" /> Mark all read</button>}
        </div>
        <div className="max-h-[420px] overflow-y-auto">
          {loading && notifications.length === 0 ? <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div> : notifications.length === 0 ? <div className="px-6 py-12 text-center"><Bell className="mx-auto mb-3 h-8 w-8 text-slate-300" /><p className="text-sm font-medium text-slate-700">You’re all caught up</p><p className="mt-1 text-xs text-slate-500">New updates will appear here.</p></div> : notifications.map((item) => <div key={item.id} className={`flex gap-3 border-b border-slate-100 px-4 py-3 last:border-0 hover:bg-slate-50 ${item.readAt ? "opacity-70" : ""}`}><span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${item.readAt ? "bg-slate-300" : "bg-retail"}`} /><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><p className="text-sm font-medium">{item.title}</p><span className="shrink-0 text-[10px] text-slate-400">{relativeTime(item.createdAt)}</span></div>{item.body && <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500">{item.body}</p>}<div className="mt-2 flex items-center gap-3"><button type="button" onClick={() => void markRead(item.id)} className="text-[11px] font-medium text-slate-500 hover:text-slate-900">Mark read</button>{item.link && <Link href={item.link} onClick={() => void markRead(item.id)} className="inline-flex items-center gap-1 text-[11px] font-semibold text-retail hover:underline">Open <ExternalLink className="h-3 w-3" /></Link>}</div></div></div>)}
        </div>
      </div>}
    </div>
  )
}
