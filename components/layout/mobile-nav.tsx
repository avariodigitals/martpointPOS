"use client"

import Link from "next/link"
import Image from "next/image"
import { useState } from "react"
import { Menu, X } from "lucide-react"
import { Button } from "@/components/ui/button"

interface MobileNavProps {
  navLinks: { label: string; href: string }[]
}

export function MobileNav({ navLinks }: MobileNavProps) {
  const [open, setOpen] = useState(false)

  return (
    <div className="lg:hidden">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 bg-background">
          <div className="container-martpoint flex h-16 items-center justify-between">
            <Link href="/" onClick={() => setOpen(false)}>
              <Image
                src="/logo.png"
                alt="MartPoint"
                width={140}
                height={36}
                className="h-8 w-auto"
                priority
              />
            </Link>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          <nav className="container-martpoint flex flex-col gap-2 pt-8">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="text-lg font-medium py-3 border-b border-border text-foreground hover:text-accent transition-colors"
              >
                {link.label}
              </Link>
            ))}

            <div className="flex flex-col gap-3 mt-8">
              <Button asChild variant="outline" className="w-full" onClick={() => setOpen(false)}>
                <Link href="/request-quote">Request Quote</Link>
              </Button>
              <Button asChild className="w-full" onClick={() => setOpen(false)}>
                <Link href="/book-demo">Book Demo</Link>
              </Button>
            </div>
          </nav>
        </div>
      )}
    </div>
  )
}
