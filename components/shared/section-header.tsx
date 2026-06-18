import { cn } from "@/lib/utils"

interface SectionHeaderProps {
  label?: string
  headline: string
  description?: string
  align?: "left" | "center" | "right"
  className?: string
  dark?: boolean
}

export function SectionHeader({
  label,
  headline,
  description,
  align = "center",
  className,
  dark = false,
}: SectionHeaderProps) {
  return (
    <div
      className={cn(
        "max-w-3xl",
        align === "center" && "mx-auto text-center",
        align === "right" && "ml-auto text-right",
        className
      )}
    >
      {label && (
        <span
          className={cn(
            "inline-block text-xs font-semibold uppercase tracking-widest mb-3",
            dark ? "text-white/70" : "text-muted-foreground"
          )}
        >
          {label}
        </span>
      )}
      <h2
        className={cn(
          "text-3xl md:text-4xl font-bold tracking-tight leading-tight",
          dark ? "text-white" : "text-foreground"
        )}
      >
        {headline}
      </h2>
      {description && (
        <p
          className={cn(
            "mt-4 text-lg leading-relaxed",
            dark ? "text-white/80" : "text-muted-foreground"
          )}
        >
          {description}
        </p>
      )}
    </div>
  )
}
