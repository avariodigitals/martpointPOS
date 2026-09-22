import { NextResponse } from "next/server"
import { recordPartnerEvent } from "@/lib/partners"
import { isPartnerBadgeTier, partnerBadgeAssetPath } from "@/lib/partner-badges"

/* Public badge image endpoint used in partner embed snippets:
 *   /api/partner-badge/{tier}/{orientation}.png?p=MP-NG-00001
 * Records a badge_impression event (with the embedding site's referer so we
 * can see where badges are placed) then 302s to the static PNG. The static
 * asset stays fully cacheable; the redirect itself revalidates so repeat
 * views keep counting. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ tier: string; file: string }> }
) {
  const { tier: rawTier, file } = await params
  const tier = rawTier.toUpperCase()
  // Keep this path extensionless — the next.config headers() rule applies
  // `immutable` caching to *.png URLs, which would cache this 302 and stop
  // impressions from being counted.
  const name = file.toLowerCase().replace(/\.png$/, "")
  const orientation = name === "horizontal" || name === "vertical" ? name : null

  if (!isPartnerBadgeTier(tier) || !orientation) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const partnerCode = (new URL(request.url).searchParams.get("p") || "").trim()
  if (partnerCode) {
    try {
      const referer = request.headers.get("referer") || ""
      await recordPartnerEvent(partnerCode, "badge_impression", {
        tier,
        orientation,
        ...(referer ? { ref: referer.slice(0, 300) } : {}),
      })
    } catch {
      /* tracking must never break the badge */
    }
  }

  const res = NextResponse.redirect(new URL(partnerBadgeAssetPath(tier, orientation), request.url), 302)
  res.headers.set("Cache-Control", "no-cache")
  return res
}
