import fs from "fs"
import path from "path"
import { HeaderClient } from "./header-client"

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

export function Header() {
  const settings = readSettings()
  const header = settings?.header || {}

  return (
    <HeaderClient
      logo={header.logo || "/logo.webp"}
      ctaText={header.ctaText || "Book a Call"}
      ctaLink={header.ctaLink || "https://wa.me/+2348036028069?text=Hi%2C%20I%20came%20across%20your%20website%20and%20I%27m%20interested%20in%20learning%20more%20about%20MartPoint%20Retail.%20Can%20we%20talk%3F"}
      secondaryCtaText={header.secondaryCtaText || "See Plans"}
      secondaryCtaLink={header.secondaryCtaLink || "/pricing"}
    />
  )
}
