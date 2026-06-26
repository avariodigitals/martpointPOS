"use client"

import dynamic from "next/dynamic"

const CookieConsentBanner = dynamic(
  () => import("./cookie-consent").then((m) => m.CookieConsentBanner),
  { ssr: false }
)

const CookieConsentSettingsButton = dynamic(
  () => import("./cookie-consent").then((m) => m.CookieConsentSettingsButton),
  { ssr: false }
)

export function CookieConsentLoader() {
  return (
    <>
      <CookieConsentBanner />
      <CookieConsentSettingsButton />
    </>
  )
}
