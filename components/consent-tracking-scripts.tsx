"use client"

import Script from "next/script"
import { useState, useEffect } from "react"

interface AnalyticsIds {
  gaId: string
  gtmId: string
  fbPixelId: string
  tiktokPixelId: string
  clarityId: string
  hotjarId: string
}

interface ConsentData {
  consent: string
  preferences: {
    necessary: boolean
    analytics: boolean
    marketing: boolean
  }
}

function getStoredConsent(): ConsentData | null {
  try {
    const raw = localStorage.getItem("martpoint_cookie_consent")
    if (raw) return JSON.parse(raw)
  } catch {
    // ignore
  }
  return null
}

export function ConsentTrackingScripts({ ids }: { ids: AnalyticsIds }) {
  const [state, setState] = useState<{ consent: ConsentData | null; mounted: boolean }>({
    consent: null,
    mounted: false,
  })

  useEffect(() => {
    const timer = setTimeout(() => {
      setState({ consent: getStoredConsent(), mounted: true })
    }, 0)

    const handler = () => setState((s) => ({ ...s, consent: getStoredConsent() }))
    window.addEventListener("consentUpdated", handler)
    return () => {
      clearTimeout(timer)
      window.removeEventListener("consentUpdated", handler)
    }
  }, [])

  // Don't render until mounted to avoid hydration mismatch
  if (!state.mounted) return null

  const consent = state.consent

  const allowAnalytics =
    consent?.consent === "accepted" ||
    (consent?.consent === "custom" && consent?.preferences?.analytics)

  const allowMarketing =
    consent?.consent === "accepted" ||
    (consent?.consent === "custom" && consent?.preferences?.marketing)

  // Enable GA4 DebugView via ?debug_mode / ?ga_debug URL param or localStorage
  // ga_debug=1 (persists across navigations).
  let gaDebug = false
  try {
    gaDebug =
      new URLSearchParams(window.location.search).has("debug_mode") ||
      new URLSearchParams(window.location.search).has("ga_debug") ||
      localStorage.getItem("ga_debug") === "1"
  } catch {
    // ignore
  }
  const debugConfig = gaDebug ? ", { debug_mode: true }" : ""

  // gtmId doubles as an optional secondary GA4 measurement ID (G-...) —
  // an extra gtag('config') reuses the already-loaded Google tag.
  const gaIds = [ids.gaId, ids.gtmId].filter(
    (id): id is string => !!id && id.startsWith("G-")
  )
  const isGtmContainer = ids.gtmId?.startsWith("GTM-")

  const gaInit = `
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    ${gaIds.map((id) => `gtag('config', '${id}'${debugConfig});`).join("\n    ")}
  `

  return (
    <>
      {allowAnalytics && gaIds.length > 0 && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${gaIds[0]}`}
            strategy="afterInteractive"
          />
          <Script id="google-analytics" strategy="afterInteractive">
            {gaInit}
          </Script>
        </>
      )}

      {(allowAnalytics || allowMarketing) && isGtmContainer && (
        <Script id="google-tag-manager" strategy="afterInteractive">
          {`
            (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
            new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
            j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
            'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
            })(window,document,'script','dataLayer','${ids.gtmId}');
          `}
        </Script>
      )}

      {allowMarketing && ids.fbPixelId && (
        <Script id="facebook-pixel" strategy="afterInteractive">
          {`
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '${ids.fbPixelId}');
            fbq('track', 'PageView');
          `}
        </Script>
      )}

      {allowMarketing && ids.tiktokPixelId && (
        <Script id="tiktok-pixel" strategy="afterInteractive">
          {`
            !function (w, d, t) {
              w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie","holdConsent","revokeConsent","grantConsent"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(
              var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var r="https://analytics.tiktok.com/i18n/pixel/events.js",o=n&&n.partner;ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=r,ttq._i[e]._partner=o||'GoogleTagManagerClient',ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{},ttq._partner=ttq._partner||'GoogleTagManagerClient';n=document.createElement("script")
              ;n.type="text/javascript",n.async=!0,n.src=r+"?sdkid="+e+"&lib="+t;e=document.getElementsByTagName("script")[0];e.parentNode.insertBefore(n,e)};

              ttq.load('${ids.tiktokPixelId}');
              ttq.page();
            }(window, document, 'ttq');
          `}
        </Script>
      )}

      {allowAnalytics && ids.clarityId && (
        <Script id="microsoft-clarity" strategy="afterInteractive">
          {`
            (function(c,l,a,r,i,t,y){
              c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
              t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
              y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
            })(window, document, "clarity", "script", "${ids.clarityId}");
          `}
        </Script>
      )}

      {allowAnalytics && ids.hotjarId && (
        <Script id="hotjar" strategy="afterInteractive">
          {`
            (function(h,o,t,j,a,r){
              h.hj=h.hj||function(){(h.hj.q=h.hj.q||[]).push(arguments)};
              h._hjSettings={hjid:${ids.hotjarId},hjsv:6};
              a=o.getElementsByTagName('head')[0];
              r=o.createElement('script');r.async=1;
              r.src=t+h._hjSettings.hjid+j+h._hjSettings.hjsv;
              a.appendChild(r);
            })(window,document,'https://static.hotjar.com/c/hotjar-','.js?sv=');
          `}
        </Script>
      )}
    </>
  )
}
