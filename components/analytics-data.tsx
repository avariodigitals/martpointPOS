import fs from "fs"
import path from "path"
import { ConsentTrackingScripts } from "./consent-tracking-scripts"

function readSettings() {
  try {
    const settingsPath = path.join(process.cwd(), "data", "settings.json")
    if (!fs.existsSync(settingsPath)) return null
    const data = fs.readFileSync(settingsPath, "utf-8")
    return JSON.parse(data)
  } catch {
    return null
  }
}

export function AnalyticsData() {
  const settings = readSettings()
  const analytics = settings?.analytics

  const ids = {
    gaId: analytics?.ga4MeasurementId || process.env.NEXT_PUBLIC_GA_ID || "",
    fbPixelId: analytics?.fbPixelId || process.env.NEXT_PUBLIC_FB_PIXEL_ID || "",
    clarityId: analytics?.clarityId || process.env.NEXT_PUBLIC_CLARITY_ID || "",
    hotjarId: analytics?.hotjarId || process.env.NEXT_PUBLIC_HOTJAR_ID || "",
  }

  return <ConsentTrackingScripts ids={ids} />
}
