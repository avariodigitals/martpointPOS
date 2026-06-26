"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { X, WifiOff, Wifi, MessageCircle, Globe, FileText, Bot, Check } from "lucide-react"

interface PopupSettings {
  enabled: boolean
  trigger: "mouseleave" | "timer" | "both"
  delaySeconds: number
  maxShowsPerSession: number
  title: string
  priceText: string
  priceSubtext: string
  ctaText: string
  ctaLink: string
}

const defaultSettings: PopupSettings = {
  enabled: true,
  trigger: "mouseleave",
  delaySeconds: 0,
  maxShowsPerSession: 1,
  title: "Start With MartPoint Retail Cloud",
  priceText: "₦99,999 / Year",
  priceSubtext: "Everything you need to run a modern retail business.",
  ctaText: "Get Started on WhatsApp",
  ctaLink: "https://wa.me/+2348036028069?text=Hi%2C%20I%20came%20across%20your%20website%20and%20I%27m%20interested%20in%20the%20MartPoint%20Retail%20Cloud%20plan.%20Can%20we%20talk%3F",
}

const SESSION_KEY = "martpoint_popup_shown"

function getSessionCount(): number {
  try {
    return parseInt(sessionStorage.getItem(SESSION_KEY) || "0", 10)
  } catch {
    return 0
  }
}

function incrementSessionCount(): number {
  try {
    const count = getSessionCount() + 1
    sessionStorage.setItem(SESSION_KEY, String(count))
    return count
  } catch {
    return 0
  }
}

export function ExitIntentPopup() {
  const [show, setShow] = useState(false)
  const [config, setConfig] = useState<PopupSettings>(defaultSettings)
  const [loaded, setLoaded] = useState(false)

  // Fetch popup settings from public API
  useEffect(() => {
    fetch("/api/settings", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (data.popup) {
          setConfig({ ...defaultSettings, ...data.popup })
        }
      })
      .catch(() => {/* fallback to defaults */})
      .finally(() => setLoaded(true))
  }, [])

  const canShow = () => {
    if (!loaded || !config.enabled) return false
    return getSessionCount() < config.maxShowsPerSession
  }

  const doShow = () => {
    if (!canShow()) return
    incrementSessionCount()
    setShow(true)
  }

  // Mouse leave trigger
  useEffect(() => {
    if (!loaded || !config.enabled) return
    if (config.trigger !== "mouseleave" && config.trigger !== "both") return

    const handleMouseLeave = (e: MouseEvent) => {
      if (e.clientY < 10 && canShow()) {
        const delayMs = config.delaySeconds * 1000
        if (delayMs > 0) {
          setTimeout(() => doShow(), delayMs)
        } else {
          doShow()
        }
      }
    }

    document.addEventListener("mouseleave", handleMouseLeave)
    return () => document.removeEventListener("mouseleave", handleMouseLeave)
  }, [loaded, config])

  // Timer trigger
  useEffect(() => {
    if (!loaded || !config.enabled) return
    if (config.trigger !== "timer" && config.trigger !== "both") return

    const delayMs = config.delaySeconds * 1000
    if (delayMs <= 0) return

    const timer = setTimeout(() => {
      doShow()
    }, delayMs)

    return () => clearTimeout(timer)
  }, [loaded, config])

  if (!loaded || !config.enabled || !show) return null

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
            {config.title}
          </h3>
          <p className="mt-3 text-lg text-muted-foreground">
            <span className="text-retail font-extrabold">{config.priceText}</span> — {config.priceSubtext}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2 text-left max-w-xs mx-auto">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <WifiOff className="w-4 h-4 text-retail shrink-0" />
              <span>Works Offline</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Wifi className="w-4 h-4 text-retail shrink-0" />
              <span>Works Online</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MessageCircle className="w-4 h-4 text-retail shrink-0" />
              <span>WhatsApp Invoice</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Globe className="w-4 h-4 text-retail shrink-0" />
              <span>Online Store</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileText className="w-4 h-4 text-retail shrink-0" />
              <span>Daily Report</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Bot className="w-4 h-4 text-retail shrink-0" />
              <span>AI Chatbot</span>
            </div>
          </div>
          <div className="mt-5 rounded-lg bg-muted p-3 text-center">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Fee Covers</p>
            <div className="mt-2 flex flex-wrap justify-center gap-x-3 gap-y-1">
              <span className="text-xs text-foreground flex items-center gap-1"><Check className="w-3 h-3 text-retail" />1 Branch</span>
              <span className="text-xs text-foreground flex items-center gap-1"><Check className="w-3 h-3 text-retail" />POS Sales</span>
              <span className="text-xs text-foreground flex items-center gap-1"><Check className="w-3 h-3 text-retail" />Inventory Control</span>
              <span className="text-xs text-foreground flex items-center gap-1"><Check className="w-3 h-3 text-retail" />WhatsApp Invoice</span>
              <span className="text-xs text-foreground flex items-center gap-1"><Check className="w-3 h-3 text-retail" />Online Store</span>
              <span className="text-xs text-foreground flex items-center gap-1"><Check className="w-3 h-3 text-retail" />AI Chatbot</span>
              <span className="text-xs text-foreground flex items-center gap-1"><Check className="w-3 h-3 text-retail" />Attendance</span>
              <span className="text-xs text-foreground flex items-center gap-1"><Check className="w-3 h-3 text-retail" />Daily Report</span>
              <span className="text-xs text-foreground flex items-center gap-1"><Check className="w-3 h-3 text-retail" />Training</span>
              <span className="text-xs text-foreground flex items-center gap-1"><Check className="w-3 h-3 text-retail" />Support</span>
            </div>
          </div>
          <div className="mt-6 flex flex-col gap-3">
            <Button asChild size="lg" variant="retail" className="w-full">
              <a
                href={config.ctaLink}
                target="_blank"
                rel="noopener noreferrer"
              >
                {config.ctaText}
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
