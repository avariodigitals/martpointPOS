import { requireCreatorSession } from "@/lib/creator-auth"
import { readSettings } from "@/lib/settings"
import { SupportClient } from "./support-client"

export default async function CreatorSupportPage() {
  const { creator } = await requireCreatorSession()
  const settings = await readSettings()
  const creatorCfg = (settings?.creator as Record<string, unknown> | undefined) || {}

  return (
    <SupportClient
      creatorName={creator.fullName}
      supportWhatsApp={(creatorCfg.supportWhatsApp as string | undefined) || ""}
      supportEmail={(creatorCfg.supportEmail as string | undefined) || ""}
    />
  )
}
