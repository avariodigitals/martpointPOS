"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { ChevronDown, LogOut, UserCircle, Wallet } from "lucide-react"
import { PortalNotificationBell } from "@/components/shared/portal-notification-bell"
import { readableRoleText } from "@/lib/utils"

interface PortalHeaderProps {
  userName: string
  userMeta?: string
  profileHref: string
  walletHref?: string
  walletLabel?: string
  logoutEndpoint: string
  loginPath: string
  quickLinks: { href: string; label: string }[]
  notificationEndpoint: string
}

function initialsOf(value: string): string {
  const parts = value.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/** Desktop portal chrome: context, quick links, notifications and profile. */
export function PortalHeader({
  userName,
  userMeta,
  profileHref,
  walletHref,
  walletLabel = "Wallet & Earnings",
  logoutEndpoint,
  loginPath,
  quickLinks,
  notificationEndpoint,
}: PortalHeaderProps) {
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function close(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false)
    }
    document.addEventListener("mousedown", close)
    return () => document.removeEventListener("mousedown", close)
  }, [])

  async function logout() {
    setMenuOpen(false)
    await fetch(logoutEndpoint, { method: "POST" }).catch(() => undefined)
    router.push(loginPath)
    router.refresh()
  }

  return (
    <header className="sticky top-0 z-40 hidden h-16 shrink-0 items-center border-b border-slate-200/80 bg-white/95 px-6 backdrop-blur md:flex lg:px-8">
      <nav aria-label="Quick links" className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
        {quickLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="shrink-0 rounded-lg px-3 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-950"
          >
            {link.label}
          </Link>
        ))}
      </nav>

      <div className="ml-4 flex shrink-0 items-center gap-3">
        <PortalNotificationBell endpoint={notificationEndpoint} variant="light" />
        <div ref={menuRef} className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((value) => !value)}
            className="group flex items-center gap-2 rounded-xl px-2 py-1.5 transition hover:bg-slate-100"
            aria-label="Open account menu"
            aria-expanded={menuOpen}
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-retail-soft text-xs font-bold text-retail ring-1 ring-inset ring-retail/15">
              {initialsOf(userName)}
            </span>
            <span className="hidden max-w-36 text-left xl:block">
              <span className="block truncate text-xs font-semibold text-slate-800">{userName}</span>
              {userMeta && <span className="block truncate text-[10px] text-slate-500">{readableRoleText(userMeta)}</span>}
            </span>
            <ChevronDown className={`hidden h-3.5 w-3.5 text-slate-400 transition xl:block ${menuOpen ? "rotate-180" : ""}`} />
            <UserCircle className="h-4 w-4 text-slate-400 xl:hidden" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-12 z-[80] w-56 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-[0_18px_50px_rgba(15,23,42,0.18)]">
              <Link href={profileHref} onClick={() => setMenuOpen(false)} className="flex items-center gap-3 px-4 py-3 text-sm text-slate-700 hover:bg-slate-50">
                <UserCircle className="h-4 w-4 text-slate-400" />
                My Profile
              </Link>
              {walletHref && (
                <Link href={walletHref} onClick={() => setMenuOpen(false)} className="flex items-center gap-3 px-4 py-3 text-sm text-slate-700 hover:bg-slate-50">
                  <Wallet className="h-4 w-4 text-slate-400" />
                  {walletLabel}
                </Link>
              )}
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
