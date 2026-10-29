"use client"

import type { EmailLayout } from "@/lib/email-layout"

export function EmailLayoutSwitch({ value, onChange, disabled = false }: {
  value: EmailLayout; onChange: (value: EmailLayout) => void; disabled?: boolean
}) {
  return (
    <fieldset disabled={disabled} className="space-y-2">
      <legend className="mb-2 text-sm font-medium">Email style</legend>
      <div className="flex flex-wrap gap-2">
        {([ ["normal", "Normal email"], ["branded", "Branded card"] ] as const).map(([layout, label]) => (
          <label key={layout} className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm ${value === layout ? "border-primary bg-primary/5" : "border-border"}`}>
            <input type="radio" value={layout} checked={value === layout} onChange={() => onChange(layout)} />
            {label}
          </label>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        {value === "normal" ? "A personal email on white, with your signature, our footer and banner." : "The MartPoint card with its blue header, footer and banner."}
      </p>
    </fieldset>
  )
}
