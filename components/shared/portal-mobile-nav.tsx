"use client"

import Link from "next/link"
import { useEffect, useState, type ElementType } from "react"
import { Menu, X } from "lucide-react"

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
      <header className="md:hidden sticky top-0 z-50 border-b border-white/10 bg-[#0A0F1C] text-white">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <h1 className="text-base font-bold leading-tight">{title}</h1>
            {subtitle && <p className="truncate text-[11px] text-gray-400">{subtitle}</p>}
          </div>

          <button
            type="button"
            onClick={onLogout}
            aria-label={logoutLabel}
            title={logoutLabel}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-retail text-sm font-semibold text-white transition-opacity hover:opacity-80"
          >
            {getInitials(userName)}
          </button>
        </div>
      </header>

      {/* Fixed bottom quick menu */}
      <footer className="md:hidden fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#0A0F1C] text-white pb-[env(safe-area-inset-bottom)]">
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
                  active ? "text-white" : "text-gray-400 hover:text-white"
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
            className="flex flex-1 flex-col items-center gap-1 px-1 py-2 text-[10px] font-medium text-gray-400 transition-colors hover:text-white"
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
            className="absolute inset-0 bg-black/60"
            onClick={() => setMoreOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute inset-x-0 bottom-0 flex max-h-[80vh] flex-col rounded-t-2xl bg-[#0A0F1C] text-white pb-[env(safe-area-inset-bottom)]">
            <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-5 py-4">
              <h2 className="text-sm font-semibold">Menu</h2>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                aria-label="Close menu"
                className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="overflow-y-auto px-3 py-3">
              {sections.map((section, sectionIndex) => (
                <div key={section.label ?? sectionIndex} className="mb-3 last:mb-0">
                  {section.label && (
                    <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
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
                              ? "bg-retail text-white"
                              : "text-gray-300 hover:bg-white/10 hover:text-white"
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
            </div>
          </div>
        </div>
      )}
    </>
  )
}
