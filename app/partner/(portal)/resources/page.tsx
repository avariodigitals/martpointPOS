import { redirect } from "next/navigation"
import { requirePartnerSession, authorizePartner, getPartnerCapabilities, getPartnerById } from "@/lib/partner-auth"
import { listPartnerResourcesForPartner, getSignedResourceUrl } from "@/lib/partner-service"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { FolderOpen, ExternalLink, FileText, Download } from "lucide-react"
import { enumLabel } from "@/lib/utils"

interface ResourceCard {
  id: string
  title: string
  description: string
  category: string
  signedUrl: string | null
  external_url: string | null
  storagePath: string | null
  builtInDownload: string | null
}

function builtInDownloadFor(title: string): string | null {
  return title.trim().toLowerCase() === "partner guide"
    ? "/partner-resources/martpoint-partner-portal-guide.pdf"
    : null
}

function ResourceGrid({ items }: { items: ResourceCard[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {items.map((r) => (
        <div key={r.id} className="p-4 rounded-xl border border-border bg-background">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-retail-soft flex items-center justify-center text-retail"><FolderOpen className="w-4 h-4" /></div>
            <div className="flex-1">
              <p className="text-sm font-semibold">{r.title}</p>
              <p className="text-xs text-muted-foreground">{enumLabel(r.category)}</p>
              {r.description && <p className="text-xs text-muted-foreground mt-1">{r.description}</p>}
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {r.signedUrl && (
              <a href={r.signedUrl} target="_blank" rel="noopener noreferrer">
                <Button size="sm" variant="outline"><ExternalLink className="w-3.5 h-3.5 mr-1" /> Preview</Button>
              </a>
            )}
            {(r.storagePath || r.builtInDownload) && (
              <a
                href={r.storagePath ? `/api/partner/resources/${encodeURIComponent(r.id)}/download` : r.builtInDownload!}
                {...(!r.storagePath ? { download: true } : {})}
              >
                <Button size="sm"><Download className="w-3.5 h-3.5 mr-1" /> Download</Button>
              </a>
            )}
            {!r.storagePath && !r.builtInDownload && r.external_url && (
              <a href={r.external_url} target="_blank" rel="noopener noreferrer">
                <Button size="sm" variant="outline"><ExternalLink className="w-3.5 h-3.5 mr-1" /> Open resource</Button>
              </a>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

export default async function PartnerResourcesPage() {
  const session = await requirePartnerSession()

  const auth = await authorizePartner({ session, permission: "partner:resources:view" })
  if (!auth.authorized) {
    redirect("/partner")
  }

  const partner = await getPartnerById(session.partnerId)
  if (!partner) redirect("/partner")

  const capabilities = await getPartnerCapabilities(session.partnerId)
  const resources = await listPartnerResourcesForPartner(partner.id, partner.partnerType, capabilities)
  const resourcesWithUrls = await Promise.all(
    resources.map(async (r) => ({
      id: r.id as string,
      title: r.title as string,
      description: r.description as string,
      category: r.category as string,
      signedUrl: await getSignedResourceUrl(r),
      external_url: r.external_url as string | null,
      storagePath: r.storage_path as string | null,
      builtInDownload: builtInDownloadFor(r.title as string),
      partner_id: r.partner_id as string | null,
    }))
  )

  const guides = resourcesWithUrls.filter((r) => !r.partner_id)
  const personalDocs = resourcesWithUrls.filter((r) => r.partner_id === partner.id)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Resources</h2>
        <p className="text-muted-foreground">Download partner-only materials.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm font-medium">Guides & Shared Materials</CardTitle></CardHeader>
        <CardContent>
          {guides.length === 0 ? <p className="text-sm text-muted-foreground">No guides available yet.</p> : (
            <ResourceGrid items={guides} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm font-medium flex items-center gap-2"><FileText className="w-4 h-4" /> Your Documents</CardTitle></CardHeader>
        <CardContent>
          {personalDocs.length === 0 ? <p className="text-sm text-muted-foreground">No documents shared with you yet.</p> : (
            <ResourceGrid items={personalDocs} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
