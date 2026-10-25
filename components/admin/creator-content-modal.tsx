"use client"

import { type ReactNode, useEffect } from "react"
import { X } from "lucide-react"

interface CreatorContentModalProps {
  title: string
  onClose: () => void
  children: ReactNode
  wide?: boolean
}

export function CreatorContentModal({ title, onClose, children, wide = false }: CreatorContentModalProps) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className={`max-h-[90vh] w-full ${wide ? "max-w-6xl" : "max-w-3xl"} overflow-y-auto rounded-xl border bg-background shadow-2xl`}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-background px-5 py-4">
          <h3 className="font-semibold">{title}</h3>
          <button type="button" onClick={onClose} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}
