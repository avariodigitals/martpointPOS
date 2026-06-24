"use client"

import { useState, useEffect } from "react"
import { Cookie, Check, X, Settings2 } from "lucide-react"

const STORAGE_KEY = "martpoint_cookie_consent"

type ConsentState = "pending" | "accepted" | "rejected" | "custom"

interface ConsentPreferences {
  necessary: boolean
  analytics: boolean
  marketing: boolean
}

function loadStoredConsent(): { consent: ConsentState; preferences: ConsentPreferences } {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved)
      return {
        consent: parsed.consent || "pending",
        preferences: parsed.preferences || { necessary: true, analytics: false, marketing: false },
      }
    }
  } catch {
    // ignore
  }
  return { consent: "pending", preferences: { necessary: true, analytics: false, marketing: false } }
}

export function useCookieConsent() {
  const stored = loadStoredConsent()
  const [consent, setConsent] = useState<ConsentState>(stored.consent)
  const [preferences, setPreferences] = useState<ConsentPreferences>(stored.preferences)

  const save = (state: ConsentState, prefs: ConsentPreferences) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ consent: state, preferences: prefs, date: new Date().toISOString() }))
    setConsent(state)
    setPreferences(prefs)
    // Dispatch event so other components can react
    window.dispatchEvent(new Event("consentUpdated"))
  }

  const acceptAll = () => save("accepted", { necessary: true, analytics: true, marketing: true })
  const rejectAll = () => save("rejected", { necessary: true, analytics: false, marketing: false })
  const saveCustom = (prefs: ConsentPreferences) => save("custom", prefs)

  return { consent, preferences, acceptAll, rejectAll, saveCustom }
}

export function CookieConsentBanner() {
  const { consent, preferences, acceptAll, rejectAll, saveCustom } = useCookieConsent()
  const [showCustomize, setShowCustomize] = useState(false)
  const [localPrefs, setLocalPrefs] = useState<ConsentPreferences>(preferences)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 0)
    return () => clearTimeout(t)
  }, [])

  if (!mounted) return null
  if (consent !== "pending") return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border shadow-2xl">
      {!showCustomize ? (
        <div className="container-martpoint py-4 md:py-5">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <Cookie className="w-5 h-5 text-retail shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-foreground">
                  We use cookies to improve your experience
                </p>
                <p className="text-xs text-muted-foreground mt-1 max-w-lg">
                  We use cookies and similar technologies to enhance your browsing experience, analyze site traffic, and serve personalized content. By clicking &quot;Accept All&quot;, you consent to our use of cookies.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setShowCustomize(true)}
                className="px-4 py-2 rounded-md text-sm font-medium border border-border hover:bg-muted transition-colors"
              >
                <Settings2 className="w-4 h-4 inline mr-1" />
                Customize
              </button>
              <button
                onClick={rejectAll}
                className="px-4 py-2 rounded-md text-sm font-medium border border-border hover:bg-muted transition-colors"
              >
                <X className="w-4 h-4 inline mr-1" />
                Reject
              </button>
              <button
                onClick={acceptAll}
                className="px-4 py-2 rounded-md text-sm font-medium bg-retail text-white hover:bg-retail/90 transition-colors"
              >
                <Check className="w-4 h-4 inline mr-1" />
                Accept All
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="container-martpoint py-4 md:py-5">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Cookie Preferences</h3>
              <button onClick={() => setShowCustomize(false)} className="text-xs text-muted-foreground hover:text-foreground">
                Back
              </button>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div>
                  <p className="text-sm font-medium">Necessary</p>
                  <p className="text-xs text-muted-foreground">Required for the website to function. Cannot be disabled.</p>
                </div>
                <input type="checkbox" checked disabled className="accent-retail" />
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div>
                  <p className="text-sm font-medium">Analytics</p>
                  <p className="text-xs text-muted-foreground">Helps us understand how visitors interact with our website.</p>
                </div>
                <input
                  type="checkbox"
                  checked={localPrefs.analytics}
                  onChange={(e) => setLocalPrefs({ ...localPrefs, analytics: e.target.checked })}
                  className="accent-retail"
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div>
                  <p className="text-sm font-medium">Marketing</p>
                  <p className="text-xs text-muted-foreground">Used to deliver relevant ads and measure campaign performance.</p>
                </div>
                <input
                  type="checkbox"
                  checked={localPrefs.marketing}
                  onChange={(e) => setLocalPrefs({ ...localPrefs, marketing: e.target.checked })}
                  className="accent-retail"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={rejectAll}
                className="px-4 py-2 rounded-md text-sm font-medium border border-border hover:bg-muted transition-colors"
              >
                Reject All
              </button>
              <button
                onClick={() => saveCustom(localPrefs)}
                className="px-4 py-2 rounded-md text-sm font-medium bg-retail text-white hover:bg-retail/90 transition-colors"
              >
                Save Preferences
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export function CookieConsentSettingsButton() {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const { consent, preferences, acceptAll, rejectAll, saveCustom } = useCookieConsent()
  const [localPrefs, setLocalPrefs] = useState<ConsentPreferences>(preferences)

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 0)
    return () => clearTimeout(t)
  }, [])

  if (!mounted) return null
  if (consent === "pending") return null

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-4 left-4 z-50 p-3 rounded-full bg-card border border-border shadow-lg hover:bg-muted transition-colors"
        title="Cookie Settings"
      >
        <Cookie className="w-5 h-5 text-retail" />
      </button>

      {open && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-end justify-center sm:items-center" onClick={() => setOpen(false)}>
          <div className="bg-card border border-border rounded-t-xl sm:rounded-xl shadow-2xl w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">Cookie Preferences</h3>
            <div className="space-y-3 mb-6">
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div>
                  <p className="text-sm font-medium">Necessary</p>
                  <p className="text-xs text-muted-foreground">Always active.</p>
                </div>
                <input type="checkbox" checked disabled className="accent-retail" />
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div>
                  <p className="text-sm font-medium">Analytics</p>
                  <p className="text-xs text-muted-foreground">Google Analytics, Microsoft Clarity, Hotjar.</p>
                </div>
                <input
                  type="checkbox"
                  checked={localPrefs.analytics}
                  onChange={(e) => setLocalPrefs({ ...localPrefs, analytics: e.target.checked })}
                  className="accent-retail"
                />
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div>
                  <p className="text-sm font-medium">Marketing</p>
                  <p className="text-xs text-muted-foreground">Facebook Pixel and similar ad trackers.</p>
                </div>
                <input
                  type="checkbox"
                  checked={localPrefs.marketing}
                  onChange={(e) => setLocalPrefs({ ...localPrefs, marketing: e.target.checked })}
                  className="accent-retail"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button onClick={() => setOpen(false)} className="px-4 py-2 rounded-md text-sm font-medium border border-border hover:bg-muted">Cancel</button>
              <button onClick={() => { rejectAll(); setOpen(false) }} className="px-4 py-2 rounded-md text-sm font-medium border border-border hover:bg-muted">Reject All</button>
              <button onClick={() => { acceptAll(); setOpen(false) }} className="px-4 py-2 rounded-md text-sm font-medium border border-border hover:bg-muted">Accept All</button>
              <button onClick={() => { saveCustom(localPrefs); setOpen(false) }} className="px-4 py-2 rounded-md text-sm font-medium bg-retail text-white hover:bg-retail/90">Save</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
