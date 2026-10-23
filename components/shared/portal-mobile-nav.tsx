"use client"

import Link from "next/link"
import { useEffect, useState, type ElementType } from "react"
import { LogOut, Menu, X } from "lucide-react"
import { PortalNotificationBell } from "@/components/shared/portal-notification-bell"

export interface PortalNavItem {
  href: string
  label: string
  icon: ElementType
}

export interface PortalNavSection {
  label?: string
  items: PortalNavItem[]
}

interface PortalMobileNavProps {
  title: string
  subtitle?: string
  userName: string
  /** Primary destinations shown in the fixed bottom bar. */
  quickItems: PortalNavItem[]
  /** Full menu shown in the "More" sheet; grouped when labels are provided. */
  sections: PortalNavSection[]
  isItemActive: (href: string) => boolean
  onLogout: () => void | Promise<void>
  logoutLabel?: string
  notificationEndpoint?: string
  profileHref?: string
}

const MAX_INITIALS = 2

function getInitials(name: string): string {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, MAX_INITIALS)
    .join("")
    .toUpperCase()
  return initials || "?"
}

/**
 * Mobile chrome shared by the creator, partner and admin portals:
 * a sticky top bar (avatar sign-out control), a fixed bottom quick menu,
 * and a slide-up "More" sheet holding the full navigation.
 */
export function PortalMobileNav({
  title,
  subtitle,
  userName,
  quickItems,
  sections,
  isItemActive,
  onLogout,
  logoutLabel = "Sign out",
  notificationEndpoint,
  profileHref,
}: PortalMobileNavProps) {
  const [moreOpen, setMoreOpen] = useState(false)

  useEffect(() => {
    if (!moreOpen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [moreOpen])

  return (
    <>
      {/* Top bar — the avatar is the only sign-out control on mobile. */}
      <header className="md:hidden sticky top-0 z-50 border-b border-slate-200 bg-white text-slate-950">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <h1 className="text-base font-bold leading-tight">{title}</h1>
            {subtitle && <p className="truncate text-[11px] text-slate-500">{subtitle}</p>}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {notificationEndpoint && <PortalNotificationBell endpoint={notificationEndpoint} />}
            {profileHref ? (
              <Link
                href={profileHref}
                aria-label="Open profile"
                title="Open profile"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-retail-soft text-sm font-semibold text-retail ring-1 ring-inset ring-retail/15 transition-opacity hover:opacity-80"
              >
                {getInitials(userName)}
              </Link>
            ) : (
              <button
                type="button"
                onClick={onLogout}
                aria-label={logoutLabel}
                title={logoutLabel}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-retail-soft text-sm font-semibold text-retail ring-1 ring-inset ring-retail/15 transition-opacity hover:opacity-80"
              >
                {getInitials(userName)}
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Fixed bottom quick menu */}
      <footer className="md:hidden fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white text-slate-700 pb-[env(safe-area-inset-bottom)]">
        <nav aria-label="Quick navigation" className="flex items-stretch">
          {quickItems.map((item) => {
            const Icon = item.icon
            const active = isItemActive(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-w-0 flex-1 flex-col items-center gap-1 px-1 py-2 text-[10px] font-medium transition-colors ${
                  active ? "text-retail" : "text-slate-400 hover:text-slate-700"
                }`}
              >
                <Icon className="h-5 w-5" />
                <span className="max-w-full truncate">{item.label}</span>
              </Link>
            )
          })}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            aria-label="Open full menu"
            className="flex flex-1 flex-col items-center gap-1 px-1 py-2 text-[10px] font-medium text-slate-400 transition-colors hover:text-slate-700"
          >
            <Menu className="h-5 w-5" />
            <span>More</span>
          </button>
        </nav>
      </footer>

      {/* Slide-up sheet with the full menu */}
      {moreOpen && (
        <div className="md:hidden fixed inset-0 z-[60]">
          <div
            className="absolute inset-0 bg-slate-950/35"
            onClick={() => setMoreOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute inset-x-0 bottom-0 flex max-h-[80vh] flex-col rounded-t-2xl bg-white text-slate-950 pb-[env(safe-area-inset-bottom)] shadow-2xl">
            <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-5 py-4">
              <h2 className="text-sm font-semibold">Menu</h2>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                aria-label="Close menu"
                className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="overflow-y-auto px-3 py-3">
              {sections.map((section, sectionIndex) => (
                <div key={section.label ?? sectionIndex} className="mb-3 last:mb-0">
                  {section.label && (
                    <p className="px-3 pb-1 pt-2 text-[10px] font-semibold normal-case tracking-wide text-slate-600">
                      {section.label}
                    </p>
                  )}
                  <div className="grid grid-cols-2 gap-1">
                    {section.items.map((item) => {
                      const Icon = item.icon
                      const active = isItemActive(item.href)
                      return (
                        <Link
                          key={`${item.href}-${item.label}`}
                          href={item.href}
                          onClick={() => setMoreOpen(false)}
                          className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                            active
                              ? "bg-retail-soft text-retail"
                              : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
                          }`}
                        >
                          <Icon className="h-4 w-4 shrink-0" />
                          <span className="truncate">{item.label}</span>
                        </Link>
                      )
                    })}
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={() => void onLogout()}
                className="mt-4 flex w-full items-center gap-2 rounded-lg border border-slate-200 px-3 py-2.5 text-left text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-950"
              >
                <LogOut className="h-4 w-4" />
                {logoutLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
