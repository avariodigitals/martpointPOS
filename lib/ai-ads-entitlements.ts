export type AiAdsEntitlements = {
  copy_generations_per_month: number
  ai_images_per_month: number
  video_exports_per_month: number
  ai_video_generations_per_month: number
  media_storage_mb: number
}

export const DEFAULT_AI_ADS_ENTITLEMENTS: AiAdsEntitlements = {
  copy_generations_per_month: 20,
  ai_images_per_month: 2,
  video_exports_per_month: 0,
  ai_video_generations_per_month: 0,
  media_storage_mb: 100,
}

const limits: Record<keyof AiAdsEntitlements, [number, number]> = {
  copy_generations_per_month: [0, 500],
  ai_images_per_month: [0, 100],
  video_exports_per_month: [0, 100],
  ai_video_generations_per_month: [0, 100],
  media_storage_mb: [0, 10000],
}

export function normalizeAiAdsEntitlements(value: unknown): AiAdsEntitlements {
  const source = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
  const result = {} as AiAdsEntitlements
  for (const key of Object.keys(DEFAULT_AI_ADS_ENTITLEMENTS) as Array<keyof AiAdsEntitlements>) {
    const candidate = Number(source[key] ?? DEFAULT_AI_ADS_ENTITLEMENTS[key])
    const [min, max] = limits[key]
    result[key] = Number.isSafeInteger(candidate) ? Math.min(max, Math.max(min, candidate)) : DEFAULT_AI_ADS_ENTITLEMENTS[key]
  }
  return result
}

export function isAiAdsOffer(addonKey: string, productCode: string, period: "monthly" | "annual"): boolean {
  if (addonKey === "ai_ads") return productCode === `ai-ads-${period}`
  if (!/^ai_ads_[a-z][a-z0-9_]{1,31}$/.test(addonKey)) return false
  const tier = addonKey.slice("ai_ads_".length)
  return productCode === `ai-ads-${tier}-${period}`
}
