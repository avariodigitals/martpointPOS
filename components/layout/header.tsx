import { HeaderClient } from "./header-client"
import { readSettings } from "@/lib/settings"

export async function Header() {
  const settings = await readSettings()
  const header = (settings?.header as Record<string, string>) || {}

  return <HeaderClient logo={header.logo || "/logo.webp"} />
}
