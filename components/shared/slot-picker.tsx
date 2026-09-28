"use client"

import { useMemo, useState } from "react"
import { Globe } from "lucide-react"
import { groupSlotsByDay } from "@/lib/scheduling"

interface SlotPickerProps {
  /** ISO timestamps (UTC instants) that are currently bookable. */
  slots: string[]
  timezone: string
  /** When provided, a timezone selector is rendered. */
  onTimezoneChange?: (tz: string) => void
  /** Extra zones offered in the selector (business tz, common zones). */
  timezoneOptions?: string[]
  selectedSlot: string | null
  onSelect: (iso: string | null) => void
  emptyMessage?: string
}

const DEFAULT_ZONES = ["Africa/Lagos", "Africa/Accra", "Africa/Nairobi", "Europe/London", "America/New_York"]

/* ─── Day + time slot picker shared by /book-demo and /meeting/[token] ─── */
export function SlotPicker({
  slots,
  timezone,
  onTimezoneChange,
  timezoneOptions = [],
  selectedSlot,
  onSelect,
  emptyMessage = "No open times are available right now.",
}: SlotPickerProps) {
  const days = useMemo(() => groupSlotsByDay(slots, timezone), [slots, timezone])
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const activeDay = selectedDay && days.some((d) => d.day === selectedDay) ? selectedDay : days[0]?.day ?? null

  const fmtTime = (iso: string) =>
    new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: timezone })

  if (days.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
        {emptyMessage}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {onTimezoneChange && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Globe className="w-3.5 h-3.5" />
          Times shown in
          <select
            value={timezone}
            onChange={(e) => onTimezoneChange(e.target.value)}
            className="rounded-md border border-input bg-background px-2 py-1 text-xs"
          >
            {[...new Set([timezone, ...timezoneOptions, ...DEFAULT_ZONES])].map((z) => (
              <option key={z} value={z}>
                {z}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {days.map((d) => (
          <button
            key={d.day}
            type="button"
            onClick={() => {
              setSelectedDay(d.day)
              onSelect(null)
            }}
            className={`shrink-0 rounded-lg border px-3 py-2 text-left transition-colors ${
              activeDay === d.day ? "border-retail bg-retail/5 ring-1 ring-retail" : "border-border hover:border-retail/40"
            }`}
          >
            <span className="block text-xs text-muted-foreground">{d.label.split(" ")[0]}</span>
            <span className="block text-sm font-medium">{d.label.split(" ").slice(1).join(" ")}</span>
            <span className="block text-[11px] text-muted-foreground">
              {d.slots.length} slot{d.slots.length === 1 ? "" : "s"}
            </span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
        {(days.find((d) => d.day === activeDay)?.slots || []).map((iso) => (
          <button
            key={iso}
            type="button"
            onClick={() => onSelect(iso)}
            className={`rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
              selectedSlot === iso ? "border-retail bg-retail text-white" : "border-border hover:border-retail/60"
            }`}
          >
            {fmtTime(iso)}
          </button>
        ))}
      </div>
    </div>
  )
}
