"use client"

import Link from "next/link"
import Image from "next/image"
import { useState, useEffect } from "react"
import { createPortal } from "react-dom"
import { Menu, X, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { mainNav, ctaNav } from "@/lib/navigation"

interface MobileNavProps {
  logo: string
}

export function MobileNav({ logo }: MobileNavProps) {
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
            <nav className="flex-1 overflow-y-auto" aria-label="Mobile navigation">
              <div className="container-martpoint py-6 flex flex-col gap-1">
                {mainNav.map((item) => {
                  if (item.children) {
                    const isExpanded = expandedGroups.includes(item.label)
                    return (
                      <div key={item.label} className="border-b border-border">
                        <button
                          onClick={() => toggleGroup(item.label)}
                          className="flex items-center justify-between w-full text-base font-semibold py-3 text-foreground hover:text-retail transition-colors"
                          aria-expanded={isExpanded}
                        >
                          {item.label}
                          <ChevronDown className={`w-5 h-5 transition-transform shrink-0 ${isExpanded ? "rotate-180" : ""}`} aria-hidden="true" />
                        </button>
                        {isExpanded && (
                          <div className="pb-4 pl-2">
                            {item.children.map((child, idx) => (
                              <div key={child.href}>
                                <Link
                                  href={child.href}
                                  onClick={() => setOpen(false)}
                                  className="flex items-center gap-3 text-base font-medium text-foreground hover:text-retail transition-colors py-3 px-2 rounded-lg active:bg-muted"
                                >
                                  {child.icon && (
                                    <div className="w-8 h-8 rounded-lg bg-retail-soft flex items-center justify-center shrink-0">
                                      <child.icon className="w-4 h-4 text-retail" aria-hidden="true" />
                                    </div>
                                  )}
                                  <div className="flex flex-col">
                                    <span>{child.label}</span>
                                    {child.description && (
                                      <span className="text-xs text-muted-foreground">{child.description}</span>
                                    )}
                                  </div>
                                </Link>
                                {idx < item.children!.length - 1 && (
                                  <div className="h-px bg-border ml-12" />
                                )}
                              </div>
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
                  <Button
                    asChild
                    className="w-full bg-retail hover:bg-retail/90 text-white"
                    onClick={() => setOpen(false)}
                  >
                    <a
                      href={ctaNav.href}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {ctaNav.label}
                    </a>
                  </Button>
                </div>
              </div>
            </nav>
          </div>,
          document.body
        )}
    </div>
  )
}
