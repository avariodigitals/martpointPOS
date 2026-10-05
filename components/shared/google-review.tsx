import { ExternalLink, Star } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getPublicSiteSettings } from "@/lib/settings"

/**
 * "Rate us on Google" prompt. Keeps our on-site testimonials as-is and gives
 * happy customers a single place to post a review on Google Business Profile —
 * so they never have to write the same testimonial twice.
 *
 * The URL is editable in Admin → Settings → Contact Information (Google Review URL).
 * Renders nothing when no URL is configured.
 */
export async function GoogleReviewCTA({
  title = "Enjoying MartPoint? Rate us on Google",
  description = "Your review helps other African businesses find us — and it only takes a minute. Post it once on Google and you're done.",
  className = "",
  compact = false,
}: {
  title?: string
  description?: string
  className?: string
  compact?: boolean
}) {
  const site = await getPublicSiteSettings()
  const url = site.googleReviewUrl?.trim()
  if (!url) return null

  return (
    <div
      className={`rounded-2xl border border-border bg-background text-center ${
        compact ? "p-6 md:p-8" : "p-8 md:p-12"
      } ${className}`}
    >
      <div className="flex justify-center gap-1 mb-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star key={i} className="w-5 h-5 text-[#fb8500] fill-[#fb8500]" />
        ))}
      </div>
      <h2
        className={`font-bold tracking-tight text-foreground ${
          compact ? "text-xl md:text-2xl" : "text-2xl md:text-3xl"
        }`}
      >
        {title}
      </h2>
      <p className="mt-3 text-muted-foreground leading-relaxed max-w-xl mx-auto">{description}</p>
      <Button asChild variant="retail" size={compact ? "default" : "lg"} className="mt-6">
        <a href={url} target="_blank" rel="noopener noreferrer">
          Leave a Google review
          <ExternalLink className="ml-2 h-4 w-4" />
        </a>
      </Button>
    </div>
  )
}
