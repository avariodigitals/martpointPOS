import { redirect } from "next/navigation"
import { requirePartnerSession, authorizePartner, getPartnerById } from "@/lib/partner-auth"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { BadgeCheck, Download } from "lucide-react"
import { PARTNER_BADGE_ORIENTATIONS, PARTNER_BADGE_TIER_LABELS, PARTNER_BADGE_WIDTHS, partnerBadgeAssetPath, partnerBadgeImageUrl, partnerBadgeSnippet, partnerBadgeVerifyUrl, partnerSiteBaseUrl, isPartnerBadgeTier } from "@/lib/partner-badges"
import { BadgeCopyButton } from "./badge-kit-client"
import { supabase } from "@/lib/supabase"

export default async function PartnerBadgeKitPage() {
  const session = await requirePartnerSession()
  const auth = await authorizePartner({ session, permission: "partner:resources:view" })
  if (!auth.authorized) redirect("/partner")
  const partner = await getPartnerById(session.partnerId)
  if (!partner) redirect("/partner")
  const { data } = await supabase.from("partner_type_grades").select("partner_type,current_grade").eq("partner_id", partner.id).in("current_grade", ["SILVER", "GOLD", "PLATINUM"])
  const badges = (data || []).filter((g) => isPartnerBadgeTier(g.current_grade) && g.current_grade !== "DIAMOND")
  const baseUrl = partnerSiteBaseUrl()

  return <div className="space-y-6">
    <div><h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight"><BadgeCheck className="h-6 w-6" /> Badge Kit</h2><p className="text-muted-foreground">Official badges are issued for the formally awarded Partner Type grade.</p></div>
    {badges.length === 0 ? <Card><CardContent className="py-10 text-center"><BadgeCheck className="mx-auto mb-3 h-10 w-10 text-muted-foreground" /><p className="text-sm font-medium">No graded Partner Type badge is available yet.</p><p className="mt-1 text-sm text-muted-foreground">A badge is available after MartPoint verifies delivery and Management awards the grade for that Partner Type.</p></CardContent></Card> : badges.map(({ partner_type: partnerType, current_grade: rawTier }) => {
      if (!isPartnerBadgeTier(rawTier) || rawTier === "DIAMOND") return null
      const tier = rawTier
      const typeLabel = partnerType === "CHANNEL" ? "Channel" : "Implementation"
      const verifyUrl = partnerBadgeVerifyUrl(baseUrl, partner.partnerId, partnerType)
      return <section className="space-y-3" key={partnerType}>
        <h3 className="font-semibold">{PARTNER_BADGE_TIER_LABELS[tier]} {typeLabel} Partner</h3>
        {PARTNER_BADGE_ORIENTATIONS.map((orientation) => {
          const assetPath = partnerBadgeAssetPath(tier, orientation)
          const imageUrl = partnerBadgeImageUrl(baseUrl, tier, orientation, partner.partnerId, partnerType)
          const snippet = partnerBadgeSnippet({ baseUrl, tier, orientation, partnerCode: partner.partnerId, partnerType })
          return <Card key={`${partnerType}-${orientation}`}><CardHeader><CardTitle className="text-sm font-medium capitalize">{typeLabel} {orientation} badge</CardTitle></CardHeader><CardContent className="space-y-4">
            <div className="flex justify-center rounded-lg border border-border bg-muted/30 p-6">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={assetPath} alt={`Official MartPoint ${PARTNER_BADGE_TIER_LABELS[tier]} ${typeLabel} Partner`} style={{ width: PARTNER_BADGE_WIDTHS[orientation], maxWidth: "100%", height: "auto" }} />
            </div>
            <div className="space-y-2"><p className="text-xs font-medium">Embed code</p><pre className="overflow-x-auto whitespace-pre-wrap break-all rounded-md bg-muted p-3 text-xs">{snippet}</pre><div className="flex flex-wrap gap-2"><BadgeCopyButton text={snippet} label="Copy HTML" /><a href={assetPath} download><Button size="sm" variant="outline"><Download className="mr-1 h-3.5 w-3.5" />Download PNG</Button></a><BadgeCopyButton text={imageUrl} label="Copy image URL" /><BadgeCopyButton text={verifyUrl} label="Copy verify link" /></div><p className="text-xs text-muted-foreground">Hosted image links are verified against the current approved grade for this Partner Type.</p></div>
          </CardContent></Card>
        })}
      </section>
    })}
  </div>
}
