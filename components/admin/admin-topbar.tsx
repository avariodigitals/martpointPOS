"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { ChevronDown, Search, Settings, ShieldCheck, UserCircle, Users, LogOut, Volume2, VolumeX } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { AdminNotificationBell } from "@/components/admin/admin-notification-bell"
import { hasPermission, type UserRole } from "@/lib/admin-types"
import { roleLabel } from "@/lib/utils"
import { AfricaBrowserPhone } from "@/components/admin/africa-browser-phone"
import { AdminAvatar } from "@/components/admin/admin-avatar"
import { enableNotificationSound, playNotificationSound } from "@/components/admin/admin-notification-sound"

const PAGE_CONTEXT: Array<{ match: string; title: string; subtitle: string }> = [
  { match: "/finance", title: "Finance", subtitle: "Commercial performance and control" },
  { match: "/partners", title: "Partners", subtitle: "Partner relationships and revenue" },
  { match: "/creators", title: "Creator Network", subtitle: "Applications, learning and performance" },
  { match: "/careers", title: "Careers", subtitle: "Talent and deployment operations" },
  { match: "/support", title: "Support", subtitle: "Customer conversations and service" },
  { match: "/customers", title: "Customers", subtitle: "Customer records and engagement" },
  { match: "/businesses", title: "Businesses", subtitle: "Business accounts and onboarding" },
  { match: "/leads", title: "Leads", subtitle: "Demand, qualification and follow-up" },
  { match: "/settings", title: "Settings", subtitle: "Configure the MartPoint workspace" },
  { match: "/reports", title: "Reports", subtitle: "Operational performance at a glance" },
  { match: "/tasks", title: "Action Centre", subtitle: "Work that needs attention" },
  { match: "/audit", title: "Audit Logs", subtitle: "A traceable record of platform activity" },
]

function contextFor(pathname: string) {
  return PAGE_CONTEXT.find((item) => pathname === item.match || pathname.startsWith(`${item.match}/`)) || {
    title: pathname === "/admin" ? "Overview" : "Control Centre",
    subtitle: "Operational source of truth for MartPoint",
  }
}

export function AdminTopbar({ userName, userRole }: { userName: string; userRole: UserRole }) {
  const pathname = usePathname()
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const [notificationSoundEnabled, setNotificationSoundEnabled] = useState(false)
  const [notificationSoundReady, setNotificationSoundReady] = useState(false)
  const [notificationSoundMessage, setNotificationSoundMessage] = useState("")
  const menuRef = useRef<HTMLDivElement>(null)
  const context = contextFor(pathname)

  useEffect(() => {
    setNotificationSoundEnabled(window.localStorage.getItem("mp-admin-notification-sound") === "enabled")
  }, [])

  useEffect(() => {
    if (!notificationSoundEnabled) return
    const unlock = () => { void enableNotificationSound().then(setNotificationSoundReady) }
    window.addEventListener("pointerdown", unlock, { once: true })
    window.addEventListener("keydown", unlock, { once: true })
    return () => {
      window.removeEventListener("pointerdown", unlock)
      window.removeEventListener("keydown", unlock)
    }
  }, [notificationSoundEnabled])

  useEffect(() => {
    function close(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false)
    }
    document.addEventListener("mousedown", close)
    return () => document.removeEventListener("mousedown", close)
  }, [])

  async function logout() {
    setMenuOpen(false)
    try { sessionStorage.removeItem("martpoint.azeraBrowserPhone.manuallyOffline") } catch { /* storage may be disabled */ }
    await fetch("/api/admin/logout", { method: "POST" }).catch(() => undefined)
    router.push("/admin/login")
    router.refresh()
  }

  async function toggleNotificationSound() {
    setNotificationSoundMessage("")
    if (notificationSoundEnabled) {
      window.localStorage.setItem("mp-admin-notification-sound", "disabled")
      setNotificationSoundEnabled(false)
      setNotificationSoundReady(false)
      return
    }

    const enabled = await enableNotificationSound()
    window.localStorage.setItem("mp-admin-notification-sound", enabled ? "enabled" : "disabled")
    setNotificationSoundEnabled(enabled)
    setNotificationSoundReady(enabled)
    if (enabled) playNotificationSound()
    else setNotificationSoundMessage("Sound is blocked by this browser. Check the site’s sound settings and try again.")
  }

  return (
    <header className="sticky top-0 z-40 flex min-h-[76px] items-center justify-between gap-4 border-b border-slate-200/80 bg-white/95 px-4 backdrop-blur sm:px-6 md:px-8">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="hidden h-2 w-2 rounded-full bg-retail sm:block" aria-hidden="true" />
          <p className="truncate text-lg font-semibold tracking-tight text-slate-950 sm:text-xl">{context.title}</p>
        </div>
        <p className="truncate text-xs text-slate-500 sm:text-sm">{context.subtitle}</p>
      </div>

      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        <Link
          href="/admin/search"
          aria-label="Search Control Centre"
          className="hidden h-10 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:bg-white hover:text-slate-950 sm:flex"
        >
          <Search className="h-4 w-4" />
          <span>Search</span>
          <kbd className="hidden rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] text-slate-400 lg:inline">⌘K</kbd>
        </Link>
        <Link
          href="/admin/search"
          aria-label="Open search"
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600 transition hover:bg-white hover:text-slate-950 sm:hidden"
        >
          <Search className="h-4 w-4" />
        </Link>
        {hasPermission(userRole, "azera") && pathname !== "/admin/azera/calls" && <AfricaBrowserPhone userName={userName} />}
        <AdminNotificationBell soundEnabled={notificationSoundEnabled} />

        <div ref={menuRef} className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((value) => !value)}
            aria-label="Open administrator profile menu"
            aria-expanded={menuOpen}
            className="group flex items-center gap-2 rounded-xl p-1.5 transition hover:bg-slate-100"
          >
            <AdminAvatar name={userName} className="h-9 w-9 rounded-full bg-retail-soft text-xs font-bold text-retail ring-1 ring-inset ring-retail/20" fallbackClassName="relative z-10" />
            <span className="hidden max-w-36 text-left lg:block">
              <span className="block truncate text-xs font-semibold text-slate-800">{userName}</span>
              <span className="block truncate text-[10px] text-slate-500">{roleLabel(userRole)}</span>
            </span>
            <ChevronDown className={`hidden h-4 w-4 text-slate-400 transition lg:block ${menuOpen ? "rotate-180" : ""}`} />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-12 z-[80] w-72 overflow-hidden rounded-2xl border border-slate-200 bg-white py-1 shadow-[0_22px_60px_rgba(15,23,42,0.18)]">
              <div className="border-b border-slate-100 px-4 py-3">
                <p className="truncate text-sm font-semibold text-slate-900">{userName}</p>
                <p className="mt-0.5 text-xs text-slate-500">{roleLabel(userRole)} · Administrator</p>
              </div>
              <Link href="/admin/profile" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 px-4 py-3 text-sm text-slate-700 hover:bg-slate-50">
                <UserCircle className="h-4 w-4 text-slate-400" />
                My Profile
              </Link>
              <Link href="/admin/notifications" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 px-4 py-3 text-sm text-slate-700 hover:bg-slate-50">
                <ShieldCheck className="h-4 w-4 text-slate-400" />
                Notifications
              </Link>
              <div className="mx-3 my-1 border-t border-slate-100" />
              <div className="px-4 py-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    {notificationSoundEnabled ? <Volume2 className="h-4 w-4 shrink-0 text-slate-400" /> : <VolumeX className="h-4 w-4 shrink-0 text-slate-400" />}
                    <span className="text-sm text-slate-700">Notification sounds</span>
                  </div>
                  <button type="button" role="switch" aria-checked={notificationSoundEnabled} aria-label="Notification sounds" onClick={() => void toggleNotificationSound()} className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${notificationSoundEnabled ? "bg-emerald-600" : "bg-slate-300"}`}>
                    <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${notificationSoundEnabled ? "translate-x-5" : "translate-x-0.5"}`} />
                  </button>
                </div>
                <p className="mt-1 text-xs text-slate-500">{notificationSoundEnabled ? notificationSoundReady ? "On" : "On · click once to activate browser sound" : "Off · enable and test sound"}</p>
                {notificationSoundMessage && <p role="status" className="mt-1 text-xs text-amber-700">{notificationSoundMessage}</p>}
              </div>
              {hasPermission(userRole, "settings") && <Link href="/admin/settings" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 px-4 py-3 text-sm text-slate-700 hover:bg-slate-50">
                <Settings className="h-4 w-4 text-slate-400" />
                Workspace settings
              </Link>}
              {hasPermission(userRole, "users") && <Link href="/admin/users" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 px-4 py-3 text-sm text-slate-700 hover:bg-slate-50">
                <Users className="h-4 w-4 text-slate-400" />
                Team members
              </Link>}
              <div className="my-1 border-t border-slate-100" />
              <button type="button" onClick={() => void logout()} className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-rose-600 hover:bg-rose-50">
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
