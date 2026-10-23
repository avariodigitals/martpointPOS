"use client"

import Link from "next/link"
import { ChevronDown, UserCircle } from "lucide-react"
import { PortalNotificationBell } from "@/components/shared/portal-notification-bell"

interface PortalHeaderProps {
  title: string
  subtitle?: string
  userName: string
  userMeta?: string
  profileHref: string
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
  title,
  subtitle,
  userName,
  userMeta,
  profileHref,
  quickLinks,
  notificationEndpoint,
}: PortalHeaderProps) {
  return (
    <header className="sticky top-0 z-40 hidden h-16 shrink-0 items-center border-b border-slate-200/80 bg-white/95 px-6 backdrop-blur md:flex lg:px-8">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-retail to-erp text-xs font-bold text-white shadow-sm">
          {initialsOf(title)}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold tracking-tight text-slate-900">{title}</p>
          {subtitle && <p className="truncate text-[11px] text-slate-500">{subtitle}</p>}
        </div>
      </div>

      <nav aria-label="Quick links" className="ml-8 flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
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
        <PortalNotificationBell endpoint={notificationEndpoint} />
        <Link
          href={profileHref}
          className="group flex items-center gap-2 rounded-xl px-2 py-1.5 transition hover:bg-slate-100"
          aria-label="Open profile"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-retail-soft text-xs font-bold text-retail ring-1 ring-inset ring-retail/15">
            {initialsOf(userName)}
          </span>
          <span className="hidden max-w-36 text-left xl:block">
            <span className="block truncate text-xs font-semibold text-slate-800">{userName}</span>
            {userMeta && <span className="block truncate text-[10px] uppercase tracking-wider text-slate-500">{userMeta}</span>}
          </span>
          <ChevronDown className="hidden h-3.5 w-3.5 text-slate-400 xl:block" />
          <UserCircle className="h-4 w-4 text-slate-400 xl:hidden" />
        </Link>
      </div>
    </header>
  )
}
