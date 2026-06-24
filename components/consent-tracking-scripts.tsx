"use client"

import Script from "next/script"
import { useState, useEffect } from "react"

interface AnalyticsIds {
  gaId: string
  fbPixelId: string
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

  return (
    <>
      {allowAnalytics && ids.gaId && ids.gaId.startsWith("G-") && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${ids.gaId}`}
            strategy="afterInteractive"
          />
          <Script id="google-analytics" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${ids.gaId}');
            `}
          </Script>
        </>
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
