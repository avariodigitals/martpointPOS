import { redirect } from "next/navigation"
import { requirePartnerSession, authorizePartner, getPartnerCapabilities, getPartnerById } from "@/lib/partner-auth"
import { listPartnerResourcesForPartner, getSignedResourceUrl } from "@/lib/partner-service"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { GraduationCap, ExternalLink, PlayCircle } from "lucide-react"

const TRAINING_CATEGORIES = ["Training", "Learning Materials", "Demo"]

export default async function PartnerTrainingPage() {
  const session = await requirePartnerSession()

  const auth = await authorizePartner({ session, permission: "partner:resources:view" })
  if (!auth.authorized) redirect("/partner")

  const partner = await getPartnerById(session.partnerId)
  if (!partner) redirect("/partner")

  const capabilities = await getPartnerCapabilities(session.partnerId)
  const all = await listPartnerResourcesForPartner(partner.id, partner.partnerType, capabilities)
  const resources = all.filter((r) => TRAINING_CATEGORIES.includes(r.category as string))
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
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2"><GraduationCap className="w-6 h-6" /> Training</h2>
        <p className="text-muted-foreground">Videos, learning materials, demos and downloadable guides.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm font-medium">Available Training</CardTitle></CardHeader>
        <CardContent>
          {resourcesWithUrls.length === 0 ? <p className="text-sm text-muted-foreground">No training materials available yet.</p> : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {resourcesWithUrls.map((r) => (
                <div key={r.id} className="p-4 rounded-xl border border-border bg-background">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600"><PlayCircle className="w-4 h-4" /></div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold">{r.title}</p>
                      <p className="text-xs text-muted-foreground">{r.category}</p>
                      {r.description && <p className="text-xs text-muted-foreground mt-1">{r.description}</p>}
                    </div>
                  </div>
                  {(r.signedUrl || r.external_url) && (
                    <a href={(r.signedUrl || r.external_url)!} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex">
                      <Button size="sm" variant="outline"><ExternalLink className="w-3.5 h-3.5 mr-1" /> Open / Download</Button>
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
