"use client"

import Link from "next/link"
import Image from "next/image"
import { useState, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { MobileNav } from "./mobile-nav"
import { mainNav, ctaNav } from "@/lib/navigation"
import { ChevronDown } from "lucide-react"
import type { NavItem } from "@/lib/navigation"

function DesktopDropdown({ item }: { item: NavItem }) {
  const [open, setOpen] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const handleMouseEnter = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    setOpen(true)
  }, [])

  const handleMouseLeave = useCallback(() => {
    timeoutRef.current = setTimeout(() => {
      setOpen(false)
    }, 150)
  }, [])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Escape") setOpen(false)
  }, [])

  if (!item.children || item.children.length === 0) {
    return (
      <Link
        href={item.href!}
        className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors py-2"
      >
        {item.label}
      </Link>
    )
  }

  const isMega = item.label === "Solutions"

  return (
    <div
      ref={containerRef}
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onKeyDown={handleKeyDown}
    >
      <button
        className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors py-2.5 outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md px-3"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        {item.label}
        <ChevronDown
          className={`w-3.5 h-3.5 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div
          className={`absolute top-full pt-2 z-50 ${
            isMega ? "left-0" : "left-0"
          }`}
          role="menu"
        >
          <div
            className={`rounded-xl border border-border bg-card shadow-2xl p-4 ${
              isMega ? "w-[540px]" : item.label === "Industries" ? "w-[560px]" : "w-72"
            }`}
          >
            <div className={isMega ? "flex flex-col gap-1" : item.label === "Industries" ? "grid grid-cols-2 gap-1" : "flex flex-col gap-0.5"}>
              {item.children.map((child, idx) => (
                <div key={child.href}>
                  <Link
                    href={child.href}
                    className={`group flex items-start gap-3 px-3 py-2.5 text-sm font-medium text-foreground hover:bg-muted rounded-lg transition-colors ${
                      child.description ? "items-start" : "items-center"
                    }`}
                    role="menuitem"
                    onClick={() => setOpen(false)}
                  >
                    {child.icon && (
                      <div className={`shrink-0 rounded-lg flex items-center justify-center ${child.description ? "w-9 h-9 bg-muted" : ""}`}>
                        <child.icon className={`text-retail shrink-0 ${child.description ? "w-4 h-4" : "w-4 h-4"}`} aria-hidden="true" />
                      </div>
                    )}
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{child.label}</span>
                        {child.badge && (
                          <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                            {child.badge}
                          </span>
                        )}
                      </div>
                      {child.description && (
                        <span className="text-xs text-muted-foreground font-normal leading-relaxed mt-0.5">
                          {child.description}
                        </span>
                      )}
                    </div>
                  </Link>
                  {isMega && idx < item.children!.length - 1 && (
                    <div className="h-px bg-border mx-3 my-1" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

interface HeaderClientProps {
  logo: string
}

export function HeaderClient({ logo }: HeaderClientProps) {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container-martpoint flex h-16 sm:h-20 lg:h-24 items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <Image
            src={logo}
            alt="MartPoint"
            width={280}
            height={72}
            className="h-9 sm:h-12 lg:h-16 w-auto"
            priority
          />
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden lg:flex items-center gap-8" aria-label="Main navigation">
          {mainNav.map((item) => (
            <DesktopDropdown key={item.label} item={item} />
          ))}
        </nav>

        {/* Desktop CTA */}
        <div className="hidden lg:flex items-center gap-4">
          {ctaNav.href.startsWith("http") ? (
            <Button asChild variant="default" size="sm" className="bg-retail hover:bg-retail/90 text-white">
              <a href={ctaNav.href} target="_blank" rel="noopener noreferrer">
                {ctaNav.label}
              </a>
            </Button>
          ) : (
            <Button asChild variant="default" size="sm" className="bg-retail hover:bg-retail/90 text-white">
              <Link href={ctaNav.href}>{ctaNav.label}</Link>
            </Button>
          )}
        </div>

        {/* Mobile Nav */}
        <MobileNav logo={logo} />
      </div>
    </header>
  )
}
