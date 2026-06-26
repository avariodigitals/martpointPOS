"use client"

import Link from "next/link"
import Image from "next/image"
import { useState, useEffect } from "react"
import { createPortal } from "react-dom"
import { Menu, X, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"

interface NavItem {
  label: string
  href?: string
  children?: { label: string; href: string; description?: string }[]
}

interface MobileNavProps {
  navItems: NavItem[]
  logo: string
  ctaText: string
  ctaLink: string
  secondaryCtaText: string
  secondaryCtaLink: string
}

export function MobileNav({ navItems, logo, ctaText, ctaLink, secondaryCtaText, secondaryCtaLink }: MobileNavProps) {
  const [open, setOpen] = useState(false)
  const [expandedGroups, setExpandedGroups] = useState<string[]>([])

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => { document.body.style.overflow = "" }
  }, [open])

  const toggleGroup = (label: string) => {
    setExpandedGroups((prev) =>
      prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]
    )
  }

  return (
    <div className="lg:hidden">
      <Button
        variant="outline"
        size="icon"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        className="shrink-0 h-9 w-9 border-border/60 bg-background hover:bg-muted"
      >
        <Menu className="h-5 w-5 text-foreground" />
      </Button>

      {open &&
        createPortal(
          <div className="fixed inset-0 z-[100] bg-background flex flex-col">
            {/* Header row */}
            <div className="shrink-0 border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
              <div className="container-martpoint flex h-16 sm:h-20 items-center justify-between">
                <Link href="/" onClick={() => setOpen(false)} className="shrink-0">
                  <Image
                    src={logo}
                    alt="MartPoint"
                    width={280}
                    height={72}
                    className="h-8 w-auto"
                    priority
                  />
                </Link>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setOpen(false)}
                  aria-label="Close menu"
                  className="shrink-0"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </div>

            {/* Scrollable nav */}
            <nav className="flex-1 overflow-y-auto">
              <div className="container-martpoint py-6 flex flex-col gap-1">
                {navItems.map((item) => {
                  if (item.children) {
                    const isExpanded = expandedGroups.includes(item.label)
                    return (
                      <div key={item.label} className="border-b border-border">
                        <button
                          onClick={() => toggleGroup(item.label)}
                          className="flex items-center justify-between w-full text-base font-semibold py-3 text-foreground hover:text-retail transition-colors"
                        >
                          {item.label}
                          <ChevronDown className={`w-5 h-5 transition-transform shrink-0 ${isExpanded ? "rotate-180" : ""}`} />
                        </button>
                        {isExpanded && (
                          <div className="pb-3 pl-4 space-y-2">
                            {item.children.map((child) => (
                              <Link
                                key={child.href}
                                href={child.href}
                                onClick={() => setOpen(false)}
                                className="block text-sm text-muted-foreground hover:text-foreground transition-colors py-1"
                              >
                                {child.label}
                              </Link>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  }
                  return (
                    <Link
                      key={item.href}
                      href={item.href!}
                      onClick={() => setOpen(false)}
                      className="text-base font-semibold py-3 border-b border-border text-foreground hover:text-retail transition-colors"
                    >
                      {item.label}
                    </Link>
                  )
                })}

                <div className="flex flex-col gap-3 mt-6">
                  {ctaLink.startsWith("http") ? (
                    <Button asChild className="w-full" onClick={() => setOpen(false)}>
                      <a href={ctaLink} target="_blank" rel="noopener noreferrer">{ctaText}</a>
                    </Button>
                  ) : (
                    <Button className="w-full" onClick={() => {
                      setOpen(false)
                      if (typeof window !== "undefined" && window.location.pathname === "/") {
                        const el = document.getElementById("whats-new")
                        if (el) setTimeout(() => el.scrollIntoView({ behavior: "smooth" }), 50)
                      }
                    }}>
                      {ctaText}
                    </Button>
                  )}
                  {secondaryCtaLink.startsWith("http") ? (
                    <Button asChild variant="outline" className="w-full" onClick={() => setOpen(false)}>
                      <a href={secondaryCtaLink} target="_blank" rel="noopener noreferrer">{secondaryCtaText}</a>
                    </Button>
                  ) : (
                    <Button asChild variant="outline" className="w-full" onClick={() => setOpen(false)}>
                      <Link href={secondaryCtaLink}>{secondaryCtaText}</Link>
                    </Button>
                  )}
                </div>
              </div>
            </nav>
          </div>,
          document.body
        )}
    </div>
  )
}
