import { readSettings } from "@/lib/settings"
import { ConsentTrackingScripts } from "./consent-tracking-scripts"

export async function AnalyticsData() {
  const settings = await readSettings()
  const analytics = settings?.analytics as Record<string, string> | undefined

  const ids = {
    gaId: analytics?.ga4MeasurementId || process.env.NEXT_PUBLIC_GA_ID || "",
    gtmId: analytics?.gtmId || process.env.NEXT_PUBLIC_GTM_ID || "",
    fbPixelId: analytics?.fbPixelId || process.env.NEXT_PUBLIC_FB_PIXEL_ID || "",
    tiktokPixelId: analytics?.tiktokPixelId || process.env.NEXT_PUBLIC_TIKTOK_PIXEL_ID || "",
    clarityId: analytics?.clarityId || process.env.NEXT_PUBLIC_CLARITY_ID || "",
    hotjarId: analytics?.hotjarId || process.env.NEXT_PUBLIC_HOTJAR_ID || "",
  }

  return <ConsentTrackingScripts ids={ids} />
}
