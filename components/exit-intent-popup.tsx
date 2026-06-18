"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { X } from "lucide-react"

export function ExitIntentPopup() {
  const [show, setShow] = useState(false)
  const [hasShown, setHasShown] = useState(false)

  useEffect(() => {
    const handleMouseLeave = (e: MouseEvent) => {
      if (e.clientY < 10 && !hasShown) {
        setShow(true)
        setHasShown(true)
      }
    }

    document.addEventListener("mouseleave", handleMouseLeave)
    return () => document.removeEventListener("mouseleave", handleMouseLeave)
  }, [hasShown])

  if (!show) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => setShow(false)}
      />
      <div className="relative w-full max-w-md rounded-2xl bg-card border border-border shadow-2xl p-8 animate-in fade-in zoom-in-95 duration-200">
        <button
          onClick={() => setShow(false)}
          className="absolute top-4 right-4 rounded-full p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center">
          <span className="inline-block rounded-full bg-retail px-3 py-1 text-xs font-bold uppercase tracking-wider text-white mb-4">
            Limited Time
          </span>
          <h3 className="text-2xl font-bold text-foreground leading-tight">
            Start With MartPoint Retail Cloud
          </h3>
          <p className="mt-3 text-lg text-muted-foreground">
            <span className="text-retail font-extrabold">₦99,999 / Year</span> — Everything you need to run a modern retail business.
          </p>
          <ul className="mt-4 space-y-1 text-sm text-muted-foreground text-left max-w-xs mx-auto">
            <li>✓ POS Sales & Inventory</li>
            <li>✓ Cloud Backup & Reports</li>
            <li>✓ Works Online & Offline</li>
            <li>✓ 1 Branch Included</li>
          </ul>
          <div className="mt-6 flex flex-col gap-3">
            <Button asChild size="lg" variant="retail" className="w-full">
              <a
                href="https://wa.me/+2348036028069?text=Hi%2C%20I%20came%20across%20your%20website%20and%20I%27m%20interested%20in%20the%20MartPoint%20Retail%20Cloud%20plan.%20Can%20we%20talk%3F"
                target="_blank"
                rel="noopener noreferrer"
              >
                Get Started on WhatsApp
              </a>
            </Button>
            <button
              onClick={() => setShow(false)}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Maybe later
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
