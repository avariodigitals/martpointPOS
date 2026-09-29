import { redirect } from "next/navigation"
import { requirePartnerSession, authorizePartner, getPartnerCapabilities, getPartnerById } from "@/lib/partner-auth"
import { listPartnerResourcesForPartner, getSignedResourceUrl } from "@/lib/partner-service"
import { listPartnerCertifications, CERTIFICATION_STATUS_LABELS, type CertificationStatus } from "@/lib/partner-certifications"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Award, ExternalLink, BadgeCheck } from "lucide-react"

const CERTIFICATION_CATEGORIES = ["Certification"]

export default async function PartnerCertificationPage() {
  const session = await requirePartnerSession()

  const auth = await authorizePartner({ session, permission: "partner:resources:view" })
  if (!auth.authorized) redirect("/partner")

  const partner = await getPartnerById(session.partnerId)
  if (!partner) redirect("/partner")

  const capabilities = await getPartnerCapabilities(session.partnerId)
  const certifications = await listPartnerCertifications(partner.id)
  const all = await listPartnerResourcesForPartner(partner.id, partner.partnerType, capabilities)
  const resources = all.filter((r) => CERTIFICATION_CATEGORIES.includes(r.category as string))
  const resourcesWithUrls = await Promise.all(
    resources.map(async (r) => ({
      id: r.id as string,
      title: r.title as string,
      description: r.description as string,
      category: r.category as string,
      signedUrl: await getSignedResourceUrl(r),
      external_url: r.external_url as string | null,
    }))
  )

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2"><Award className="w-6 h-6" /> Certification</h2>
        <p className="text-muted-foreground">Download your partnership certificate and related credentials.</p>
      </div>

      {certifications.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <BadgeCheck className="w-4 h-4" /> Certification Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {certifications.map((c) => {
                const status = c.status as CertificationStatus
                const expired = status === "EXPIRED" || (c.expires_at && new Date(c.expires_at as string) < new Date())
                return (
                  <div key={c.id as string} className="p-4 rounded-xl border border-border bg-background flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">{c.programme as string} Certification</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {c.score != null ? `Score ${c.score}% · ` : ""}
                        {c.supervised_delivery ? "Supervised delivery required · " : ""}
                        {c.expires_at ? `Expires ${new Date(c.expires_at as string).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}` : "No expiry recorded"}
                      </p>
                      {!!c.restrictions && <p className="text-xs text-muted-foreground mt-1">Restrictions: {c.restrictions as string}</p>}
                      {!!expired && (
                        <p className="text-xs text-amber-700 bg-amber-50 rounded-md px-3 py-2 mt-2">
                          This certification has expired. Contact Partner Operations to schedule reassessment.
                        </p>
                      )}
                    </div>
                    <span className={`text-[10px] uppercase px-2 py-0.5 rounded-full font-medium ${
                      status === "CERTIFIED" ? "bg-green-100 text-green-700"
                      : status === "EXPIRED" || status === "REVOKED" ? "bg-red-100 text-red-700"
                      : "bg-blue-100 text-blue-700"
                    }`}>
                      {CERTIFICATION_STATUS_LABELS[status] || status}
                    </span>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-sm font-medium">Certificates</CardTitle></CardHeader>
        <CardContent>
          {resourcesWithUrls.length === 0 ? <p className="text-sm text-muted-foreground">No certificates available yet. They will be uploaded by the MartPoint team.</p> : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {resourcesWithUrls.map((r) => (
                <div key={r.id} className="p-4 rounded-xl border border-border bg-background">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-green-50 flex items-center justify-center text-green-600"><Award className="w-4 h-4" /></div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold">{r.title}</p>
                      <p className="text-xs text-muted-foreground">{r.category}</p>
                      {r.description && <p className="text-xs text-muted-foreground mt-1">{r.description}</p>}
                    </div>
                  </div>
                  {(r.signedUrl || r.external_url) && (
                    <a href={(r.signedUrl || r.external_url)!} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex">
                      <Button size="sm" variant="outline"><ExternalLink className="w-3.5 h-3.5 mr-1" /> Download</Button>
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
