import { requireCreatorSession } from "@/lib/creator-auth"
import { readSettings } from "@/lib/settings"
import { getBusinessHours } from "@/lib/support"
import { SupportClient } from "./support-client"

const DAY_NAMES = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

function fmtDays(days: number[]): string {
  if (!days.length) return ""
  const sorted = [...days].sort((a, b) => a - b)
  const contiguous = sorted.every((d, i) => i === 0 || d === sorted[i - 1] + 1)
  if (contiguous && sorted.length > 2) return `${DAY_NAMES[sorted[0]]}–${DAY_NAMES[sorted[sorted.length - 1]]}`
  return sorted.map((d) => DAY_NAMES[d]).join(", ")
}

function fmtTime(t: string): string {
  const [h, m] = t.split(":").map(Number)
  const suffix = h >= 12 ? "PM" : "AM"
  const hour = h % 12 || 12
  return `${hour}:${String(m).padStart(2, "0")} ${suffix}`
}

export default async function CreatorSupportPage() {
  const { creator } = await requireCreatorSession()
  const [settings, hours] = await Promise.all([readSettings(), getBusinessHours()])
  const creatorCfg = (settings?.creator as Record<string, unknown> | undefined) || {}

  const supportHours = hours?.active
    ? `${fmtDays(hours.working_days)} · ${fmtTime(hours.opening_time)} – ${fmtTime(hours.closing_time)}${hours.timezone ? ` (${hours.timezone.replace("_", " ")})` : ""}`
    : ""

  return (
    <SupportClient
      creatorName={creator.fullName}
      supportWhatsApp={(creatorCfg.supportWhatsApp as string | undefined) || ""}
      supportEmail={(creatorCfg.supportEmail as string | undefined) || ""}
      supportHours={supportHours}
    />
  )
}
