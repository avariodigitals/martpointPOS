"use client"

import Link from "next/link"
import Image from "next/image"
import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { MobileNav } from "./mobile-nav"
import { ChevronDown, ShoppingCart, Building2, FileText, HelpCircle, Tag, Users, MessageCircle, MapPin } from "lucide-react"

interface NavItem {
  label: string
  href?: string
  children?: { label: string; href: string; description?: string; icon?: React.ElementType }[]
}

const navItems: NavItem[] = [
  {
    label: "Products",
    children: [
      { label: "MartPoint Retail", href: "/martpoint-retail", icon: ShoppingCart },
      { label: "MartPoint ERP", href: "/martpoint-erp", icon: Building2 },
    ],
  },
  {
    label: "Resources",
    children: [
      { label: "Blog", href: "/blog", icon: FileText },
      { label: "FAQs", href: "/faqs", icon: HelpCircle },
      { label: "Pricing", href: "/pricing", icon: Tag },
    ],
  },
  {
    label: "Company",
    children: [
      { label: "About Us", href: "/about", icon: Users },
      { label: "Contact", href: "/contact", icon: MessageCircle },
      { label: "Industries", href: "/industries", icon: MapPin },
    ],
  },
]

function NavDropdown({ item }: { item: NavItem }) {
  const [open, setOpen] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleMouseEnter = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    setOpen(true)
  }

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setOpen(false)
    }, 150)
  }

  if (!item.children) {
    return (
      <Link
        href={item.href!}
        className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        {item.label}
      </Link>
    )
  }

  return (
    <div
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        onClick={() => setOpen(!open)}
      >
        {item.label}
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-2 w-48 rounded-xl border border-border bg-background shadow-lg p-1.5 z-50">
          {item.children.map((child) => (
            <Link
              key={child.href}
              href={child.href}
              className="block rounded-lg px-3 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
              onClick={() => setOpen(false)}
            >
              {child.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

interface HeaderClientProps {
  logo: string
  ctaText: string
  ctaLink: string
  secondaryCtaText: string
  secondaryCtaLink: string
}

export function HeaderClient({ logo, ctaText, ctaLink, secondaryCtaText, secondaryCtaLink }: HeaderClientProps) {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container-martpoint flex h-16 sm:h-20 lg:h-24 items-center justify-between">
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

        <nav className="hidden lg:flex items-center gap-8">
          {navItems.map((item) => (
            <NavDropdown key={item.label} item={item} />
          ))}
        </nav>

        <div className="hidden lg:flex items-center gap-4">
          {secondaryCtaLink.startsWith("http") ? (
            <a
              href={secondaryCtaLink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              {secondaryCtaText}
            </a>
          ) : (
            <Link
              href={secondaryCtaLink}
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              {secondaryCtaText}
            </Link>
          )}
          {ctaLink.startsWith("http") ? (
            <Button asChild variant="default" size="sm">
              <a href={ctaLink} target="_blank" rel="noopener noreferrer">{ctaText}</a>
            </Button>
          ) : (
            <Button asChild variant="default" size="sm">
              <Link
                href={ctaLink}
                onClick={(e) => {
                  if (typeof window !== "undefined" && window.location.pathname === "/") {
                    e.preventDefault()
                    const el = document.getElementById("whats-new")
                    if (el) el.scrollIntoView({ behavior: "smooth" })
                  }
                }}
              >
                {ctaText}
              </Link>
            </Button>
          )}
        </div>

        <MobileNav
          navItems={navItems}
          logo={logo}
          ctaText={ctaText}
          ctaLink={ctaLink}
          secondaryCtaText={secondaryCtaText}
          secondaryCtaLink={secondaryCtaLink}
        />
      </div>
    </header>
  )
}
