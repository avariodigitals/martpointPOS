import { Button } from "@/components/ui/button"
import { Check } from "lucide-react"
import type { ResolvedCloudPlan } from "@/lib/pricing-plans"

export function PlanCard({ plan }: { plan: ResolvedCloudPlan }) {
  const isHighlighted = plan.badge !== ""
  const isExternal = plan.ctaLink.startsWith("http")

  return (
    <div
      className={`relative rounded-2xl ${isHighlighted ? "border-2 border-retail" : "border border-border"} bg-card p-6 shadow-sm flex flex-col`}
    >
      {isHighlighted && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="inline-block rounded-full bg-retail px-4 py-1 text-xs font-bold uppercase tracking-wider text-white">
            {plan.badge}
          </span>
        </div>
      )}
      <h3 className="text-lg font-bold text-foreground mt-2">{plan.displayName}</h3>
      <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Annual licence</p>
      <div className="mt-1 flex flex-col items-start">
        <span className={`text-3xl sm:text-4xl font-extrabold ${isHighlighted ? "text-retail" : "text-foreground"}`}>
          {plan.priceText}
        </span>
        <span className="text-muted-foreground">/ year</span>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{plan.description}</p>

      <ul className="mt-5 space-y-2.5 flex-1 text-sm">
        <li className="flex items-center gap-2 text-foreground">
          <Check className="w-4 h-4 text-retail shrink-0" />
          {plan.limits.branches} branch{plan.limits.branches !== 1 ? "es" : ""} · {plan.limits.namedUsers} users
        </li>
        <li className="flex items-center gap-2 text-foreground">
          <Check className="w-4 h-4 text-retail shrink-0" />
          {plan.limits.mainProducts.toLocaleString("en-NG")} main products
        </li>
        <li className="flex items-center gap-2 text-foreground">
          <Check className="w-4 h-4 text-retail shrink-0" />
          {plan.limits.onlineProducts.toLocaleString("en-NG")} online store products
        </li>
        <li className="flex items-center gap-2 text-foreground">
          <Check className="w-4 h-4 text-retail shrink-0" />
          {plan.limits.services.toLocaleString("en-NG")} services · {plan.limits.mediaGb} GB media
        </li>
        <li className="flex items-center gap-2 text-foreground">
          <Check className="w-4 h-4 text-retail shrink-0" />
          {plan.limits.storefronts} storefront{plan.limits.storefronts !== 1 ? "s" : ""} · {plan.limits.customDomains} custom domain{plan.limits.customDomains !== 1 ? "s" : ""}
        </li>
      </ul>

      <div className="mt-6">
        {isExternal ? (
          <Button asChild size="lg" variant={isHighlighted ? "retail" : "outline"} className="w-full">
            <a href={plan.ctaLink} target="_blank" rel="noopener noreferrer">
              {plan.ctaText}
            </a>
          </Button>
        ) : (
          <Button asChild size="lg" variant={isHighlighted ? "retail" : "outline"} className="w-full">
            <a href={plan.ctaLink}>{plan.ctaText}</a>
          </Button>
        )}
      </div>
    </div>
  )
}
