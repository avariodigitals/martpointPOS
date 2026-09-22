/* ───────────────────────────  Partner badge kit  ───────────────────────────
 * Tier badges (Silver/Gold/Platinum/Diamond) partners embed on their sites.
 * The PNGs are generic per tier — the only per-partner value is the partner
 * code baked into the verification link and the routed image URL (which logs
 * a badge_impression event before serving the static asset).
 */

export const PARTNER_BADGE_TIERS = ["SILVER", "GOLD", "PLATINUM", "DIAMOND"] as const
export type PartnerBadgeTier = (typeof PARTNER_BADGE_TIERS)[number]

export const PARTNER_BADGE_TIER_LABELS: Record<PartnerBadgeTier, string> = {
  SILVER: "Silver",
  GOLD: "Gold",
  PLATINUM: "Platinum",
  DIAMOND: "Diamond",
}

export type PartnerBadgeOrientation = "horizontal" | "vertical"

export const PARTNER_BADGE_ORIENTATIONS: PartnerBadgeOrientation[] = ["horizontal", "vertical"]

export const PARTNER_BADGE_WIDTHS: Record<PartnerBadgeOrientation, number> = {
  horizontal: 360,
  vertical: 240,
}

export function isPartnerBadgeTier(value: unknown): value is PartnerBadgeTier {
  return typeof value === "string" && (PARTNER_BADGE_TIERS as readonly string[]).includes(value)
}

export function partnerSiteBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_BASE_URL || "https://www.martpoint.com.ng").replace(/\/$/, "")
}

/** Static PNG path under /public/assets/partner-badges/. */
export function partnerBadgeAssetPath(tier: PartnerBadgeTier, orientation: PartnerBadgeOrientation): string {
  const t = tier.toLowerCase()
  return `/assets/partner-badges/${t}/martpoint-${t}-partner-${orientation}.png`
}

/**
 * Routed badge image URL: hits /api/partner-badge which records a
 * badge_impression event (with the embedding site's referer) then redirects
 * to the static PNG. This is what goes into the embed snippet.
 * NOTE: intentionally extensionless — a `.png` suffix would match the
 * immutable cache rule in next.config and stop impressions being counted.
 */
export function partnerBadgeImageUrl(
  baseUrl: string,
  tier: PartnerBadgeTier,
  orientation: PartnerBadgeOrientation,
  partnerCode: string
): string {
  return `${baseUrl}/api/partner-badge/${tier.toLowerCase()}/${orientation}?p=${encodeURIComponent(partnerCode)}`
}

/** Public verification link baked into badge snippets. */
export function partnerBadgeVerifyUrl(baseUrl: string, partnerCode: string): string {
  return `${baseUrl}/partners/verify?partner=${encodeURIComponent(partnerCode)}`
}

/** Full HTML embed snippet for a partner to paste on their site. */
export function partnerBadgeSnippet(options: {
  baseUrl: string
  tier: PartnerBadgeTier
  orientation: PartnerBadgeOrientation
  partnerCode: string
}): string {
  const { baseUrl, tier, orientation, partnerCode } = options
  const label = PARTNER_BADGE_TIER_LABELS[tier]
  const width = PARTNER_BADGE_WIDTHS[orientation]
  const href = partnerBadgeVerifyUrl(baseUrl, partnerCode)
  const src = partnerBadgeImageUrl(baseUrl, tier, orientation, partnerCode)
  return `<a href="${href}" target="_blank" rel="noopener noreferrer" aria-label="Verify this MartPoint ${label} Partner">
  <img src="${src}" alt="Official MartPoint ${label} Partner" width="${width}" style="display:block;max-width:100%;height:auto;border:0" loading="lazy">
</a>`
}
