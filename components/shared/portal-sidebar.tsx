"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { readableRoleText } from "@/lib/utils"
import {
  ChevronDown,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  X,
  type LucideIcon,
} from "lucide-react"

export interface PortalNavItem {
  href: string
  label: string
  icon: LucideIcon
}

export interface PortalNavSection {
  /** Omit for a flat menu — those items render with no section header. */
  label?: string
  items: PortalNavItem[]
}

interface PortalSidebarProps {
  title: string
  subtitle?: string
  /** Small mono lines under the subtitle (creator code, partner id…). */
  meta?: string[]
  sections: PortalNavSection[]
  userName: string
  /** Role / level line shown under the user name. */
  userMeta?: string
  /** Extra muted line in the footer (e.g. partner capabilities). */
  footerNote?: string
  onLogout: () => void
  logoutLabel: string
  /** localStorage namespace, so each portal remembers its own state. */
  storageKey: string
  isItemActive: (href: string) => boolean
  showFooterUser?: boolean
}

function initialsOf(value: string): string {
  const parts = value.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

const FOCUS_RING = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-retail/50"

/**
 * Shared portal sidebar (Control Centre, Creator Portal, Partner Portal).
 *
 * Pinned header + independently scrolling nav + pinned footer, so the brand,
 * the filter and the user/logout block stay put however long the menu grows.
 * Folds to an icon rail, remembers the choice per portal, and filters items
 * that the caller has already permission-filtered.
 */
export function PortalSidebar({
  title,
  subtitle,
  meta,
  sections,
  userName,
  userMeta,
  footerNote,
  onLogout,
  logoutLabel,
  storageKey,
  isItemActive,
  showFooterUser = true,
}: PortalSidebarProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [openSections, setOpenSections] = useState<Record<string, boolean> | null>(null)
  const [query, setQuery] = useState("")

  // Hydrate from localStorage after mount so the first client render matches the server.
  // null openSections = not yet hydrated → fall back to "section with the active page is open".
  useEffect(() => {
    let storedCollapsed = false
    let storedSections: Record<string, boolean> = {}
    try {
      storedCollapsed = localStorage.getItem(`${storageKey}-collapsed`) === "1"
      storedSections = JSON.parse(localStorage.getItem(`${storageKey}-sections`) || "{}")
    } catch {}
    const t = setTimeout(() => {
      setCollapsed(storedCollapsed)
      setOpenSections(storedSections)
    }, 0)
    return () => clearTimeout(t)
  }, [storageKey])

  const toggleCollapsed = () => {
    const next = !collapsed
    setCollapsed(next)
    try {
      localStorage.setItem(`${storageKey}-collapsed`, next ? "1" : "0")
    } catch {}
  }

  const term = query.trim().toLowerCase()
  const searching = term.length > 0
  const filteredSections: PortalNavSection[] = searching
    ? sections
        .map((section) => ({
          ...section,
          items: section.items.filter(
            (item) =>
              item.label.toLowerCase().includes(term) ||
              (section.label || "").toLowerCase().includes(term),
          ),
        }))
        .filter((section) => section.items.length > 0)
    : sections

  const isSectionOpen = (section: PortalNavSection) => {
    if (!section.label) return true // flat menu — nothing to fold
    if (openSections && section.label in openSections) return openSections[section.label]
    return section.items.some((item) => isItemActive(item.href))
  }

  const toggleSection = (section: PortalNavSection, currentlyOpen: boolean) => {
    if (!section.label) return
    const next = { ...(openSections || {}), [section.label]: !currentlyOpen }
    setOpenSections(next)
    try {
      localStorage.setItem(`${storageKey}-sections`, JSON.stringify(next))
    } catch {}
  }

  return (
    <aside
      className={`hidden md:flex md:flex-col md:sticky md:top-0 md:self-start md:h-screen shrink-0 border-r border-slate-200 bg-white text-slate-700 shadow-[1px_0_0_rgba(15,23,42,0.02)] transition-[width] duration-200 ${
        collapsed ? "md:w-16" : "md:w-64"
      }`}
    >
      {/* Header — pinned */}
      <div className={`shrink-0 ${collapsed ? "px-2 py-4" : "px-5 py-5"}`}>
        {collapsed ? (
          <div className="flex flex-col items-center gap-3">
            <span
              aria-hidden
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-retail-soft text-[11px] font-semibold text-retail ring-1 ring-inset ring-retail/15"
            >
              {initialsOf(title)}
            </span>
            <button
              type="button"
              onClick={toggleCollapsed}
              title="Expand menu"
              aria-label="Expand menu"
              aria-expanded={false}
              className={`rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-900 ${FOCUS_RING}`}
            >
              <PanelLeftOpen className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h1 className="text-lg font-semibold tracking-tight text-slate-950">{title}</h1>
                {subtitle && <p className="mt-0.5 truncate text-[11px] text-slate-500">{subtitle}</p>}
                {meta?.map((line) => (
                  <p key={line} className="mt-0.5 truncate font-mono text-[10px] text-retail/70">
                    {line}
                  </p>
                ))}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={toggleCollapsed}
                  title="Collapse menu"
                  aria-label="Collapse menu"
                  aria-expanded
                  className={`rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-900 ${FOCUS_RING}`}
                >
                  <PanelLeftClose className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="relative mt-3">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setQuery("")
                }}
                placeholder="Filter menu"
                aria-label="Filter menu"
                className="w-full rounded-lg bg-slate-50 py-1.5 pl-8 pr-8 text-[13px] text-slate-800 placeholder-slate-400 outline-none ring-1 ring-inset ring-slate-200 transition focus:bg-white focus:ring-retail/40 [&::-webkit-search-cancel-button]:hidden"
              />
              {searching && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="Clear filter"
                  className={`absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 transition hover:text-slate-700 ${FOCUS_RING}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {/* Nav — the only scrolling region */}
      <nav
        className={`min-h-0 flex-1 overflow-y-auto ${collapsed ? "space-y-1 px-2 py-2" : "space-y-4 px-3 pb-3"}`}
      >
        {filteredSections.map((section, index) => {
          // Folding the rail or searching shows every match; the accordion only applies otherwise.
          const open = collapsed || searching ? true : isSectionOpen(section)
          return (
            <div
              key={section.label || `flat-${index}`}
              className={collapsed && index > 0 ? "border-t border-slate-200 pt-1" : ""}
            >
              {section.label && !collapsed && (
                <button
                  type="button"
                  onClick={() => toggleSection(section, open)}
                  aria-expanded={open}
                  className={`mb-0.5 flex w-full items-center justify-between rounded px-2 py-1 text-[11px] font-semibold normal-case tracking-wide text-slate-600 transition-colors hover:text-slate-950 ${FOCUS_RING}`}
                >
                  {section.label}
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "" : "-rotate-90"}`} />
                </button>
              )}
              {open && (
                <div className={collapsed ? "space-y-1" : "space-y-0.5"}>
                  {section.items.map((item) => {
                    const active = isItemActive(item.href)
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        title={collapsed ? item.label : undefined}
                        aria-current={active ? "page" : undefined}
                        className={`relative flex items-center rounded-lg transition-colors ${FOCUS_RING} ${
                          collapsed
                            ? "justify-center px-0 py-2.5"
                            : "gap-2.5 px-3 py-1.5 text-[13px] leading-tight"
                        } ${
                          active
                            ? "bg-retail-soft font-semibold text-retail ring-1 ring-inset ring-retail/10"
                            : "font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-950"
                        }`}
                      >
                        <item.icon className="h-4 w-4 shrink-0" />
                        {collapsed ? (
                          <span className="sr-only">{item.label}</span>
                        ) : (
                          <span>{item.label}</span>
                        )}
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}

        {searching && filteredSections.length === 0 && (
          <p className="px-3 py-6 text-center text-xs text-slate-400">
            No menu items match &ldquo;{query.trim()}&rdquo;.
          </p>
        )}
      </nav>

      {/* Optional footer — admin uses the workspace header; partner/creator portals may keep account controls here. */}
      {showFooterUser && <div className={`shrink-0 border-t border-slate-200 ${collapsed ? "p-2" : "px-3 py-4"}`}>
        {collapsed ? (
          <div className="flex flex-col items-center gap-2">
            <span
              aria-hidden
              title={userName}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-retail-soft text-[10px] font-semibold text-retail ring-1 ring-inset ring-retail/15"
            >
              {initialsOf(userName)}
            </span>
            <button
              type="button"
              onClick={onLogout}
              title={logoutLabel}
              aria-label={logoutLabel}
              className={`rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-950 ${FOCUS_RING}`}
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <>
            <div className="mb-3 px-3">
              <p className="truncate text-[13px] font-medium text-slate-800">{userName}</p>
              {userMeta && (
                <p className="truncate text-[10px] normal-case tracking-wide text-slate-500">{readableRoleText(userMeta)}</p>
              )}
              {footerNote && <p className="mt-1 truncate text-[10px] text-slate-400">{footerNote}</p>}
            </div>
            <button
              type="button"
              onClick={onLogout}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-950 ${FOCUS_RING}`}
            >
              <LogOut className="h-4 w-4" />
              {logoutLabel}
            </button>
          </>
        )}
      </div>}
    </aside>
  )
}
