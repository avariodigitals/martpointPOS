import { redirect } from "next/navigation"
import { requirePartnerSession, authorizePartner, getPartnerById } from "@/lib/partner-auth"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { BadgeCheck, Download } from "lucide-react"
import {
  PARTNER_BADGE_ORIENTATIONS,
  PARTNER_BADGE_TIER_LABELS,
  PARTNER_BADGE_WIDTHS,
  partnerBadgeAssetPath,
  partnerBadgeImageUrl,
  partnerBadgeSnippet,
  partnerBadgeVerifyUrl,
  partnerSiteBaseUrl,
} from "@/lib/partner-badges"
import { BadgeCopyButton } from "./badge-kit-client"

export default async function PartnerBadgeKitPage() {
  const session = await requirePartnerSession()

  const auth = await authorizePartner({ session, permission: "partner:resources:view" })
  if (!auth.authorized) redirect("/partner")

  const partner = await getPartnerById(session.partnerId)
  if (!partner) redirect("/partner")

  const tier = partner.badgeTier
  const baseUrl = partnerSiteBaseUrl()
  const verifyUrl = partnerBadgeVerifyUrl(baseUrl, partner.partnerId)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2"><BadgeCheck className="w-6 h-6" /> Badge Kit</h2>
        <p className="text-muted-foreground">Your official MartPoint partner badge. Embed it on your website so customers can verify your partnership.</p>
      </div>

      {!tier ? (
        <Card>
          <CardContent className="py-10 text-center">
            <BadgeCheck className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm font-medium">No badge issued yet</p>
            <p className="text-sm text-muted-foreground mt-1">Your badge kit has not been generated. Contact your MartPoint partner manager.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardContent className="py-4">
              <p className="text-sm">
                You are an official <span className="font-semibold">{PARTNER_BADGE_TIER_LABELS[tier]} Partner</span>.
                Paste the HTML snippet into your website — the badge links to your public verification page
                (<span className="font-mono text-xs">{verifyUrl}</span>).
              </p>
            </CardContent>
          </Card>

          {PARTNER_BADGE_ORIENTATIONS.map((orientation) => {
            const assetPath = partnerBadgeAssetPath(tier, orientation)
            const imageUrl = partnerBadgeImageUrl(baseUrl, tier, orientation, partner.partnerId)
            const snippet = partnerBadgeSnippet({ baseUrl, tier, orientation, partnerCode: partner.partnerId })
            return (
              <Card key={orientation}>
                <CardHeader><CardTitle className="text-sm font-medium capitalize">{orientation} badge</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-lg border border-border bg-muted/30 p-6 flex justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={assetPath}
                      alt={`Official MartPoint ${PARTNER_BADGE_TIER_LABELS[tier]} Partner`}
                      style={{ width: PARTNER_BADGE_WIDTHS[orientation], maxWidth: "100%", height: "auto" }}
                    />
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-medium">Embed code</p>
                    <pre className="text-xs bg-muted rounded-md p-3 overflow-x-auto whitespace-pre-wrap break-all">{snippet}</pre>
                    <div className="flex flex-wrap gap-2">
                      <BadgeCopyButton text={snippet} label="Copy HTML" />
                      <a href={assetPath} download>
                        <Button size="sm" variant="outline"><Download className="w-3.5 h-3.5 mr-1" /> Download PNG</Button>
                      </a>
                      <BadgeCopyButton text={imageUrl} label="Copy image URL" />
                      <BadgeCopyButton text={verifyUrl} label="Copy verify link" />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Use the hosted image URL — it keeps artwork up to date and lets us count badge views.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </>
      )}
    </div>
  )
}
