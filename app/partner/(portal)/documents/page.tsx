import { redirect } from "next/navigation"
import { requirePartnerSession, authorizePartner } from "@/lib/partner-auth"
import {
  listGeneratedDocuments,
  getGeneratedDocumentSignedUrl,
  GENERATED_DOC_TYPE_LABELS,
  ACKNOWLEDGEABLE_TYPES,
} from "@/lib/partner-generated-docs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { FileText, Download } from "lucide-react"
import { AcknowledgeButton } from "./documents-client"

function fmtDate(iso?: string | null) {
  if (!iso) return "—"
  try {
    return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
  } catch {
    return iso
  }
}

function statusClass(status: string) {
  switch (status) {
    case "ACCEPTED":
    case "SIGNED":
      return "bg-green-100 text-green-700"
    case "ISSUED":
      return "bg-blue-100 text-blue-700"
    case "DRAFT":
      return "bg-gray-100 text-gray-700"
    case "CANCELLED":
    case "EXPIRED":
      return "bg-red-100 text-red-700"
    default:
      return "bg-gray-100 text-gray-700"
  }
}

export default async function PartnerDocumentsPage() {
  const session = await requirePartnerSession()

  const auth = await authorizePartner({ session, permission: "partner:resources:view" })
  if (!auth.authorized) redirect("/partner")

  const docs = await listGeneratedDocuments(session.partnerId)
  const withUrls = await Promise.all(
    docs.map(async (d) => ({
      ...d,
      signedUrl: await getGeneratedDocumentSignedUrl(d.id, {
        partnerId: session.partnerId,
        actor: { actorType: "PARTNER", actorId: session.partnerUserId },
      }),
    }))
  )

  const canAcknowledge = session.role === "PARTNER_OWNER" || session.role === "PARTNER_MANAGER"

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Documents</h2>
        <p className="text-muted-foreground">
          Official records issued to you by MartPoint — agreements, assignments, statements and notices.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <FileText className="w-4 h-4" /> Issued Documents
          </CardTitle>
        </CardHeader>
        <CardContent>
          {withUrls.length === 0 ? (
            <p className="text-sm text-muted-foreground">No documents issued yet.</p>
          ) : (
            <div className="space-y-3">
              {withUrls.map((d) => {
                const needsAck =
                  ACKNOWLEDGEABLE_TYPES.includes(d.documentType) && d.status === "ISSUED"
                return (
                  <div key={d.id} className="p-4 rounded-xl border border-border bg-background">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1">
                        <div className="w-9 h-9 rounded-lg bg-retail-soft flex items-center justify-center text-retail">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-semibold">{d.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {GENERATED_DOC_TYPE_LABELS[d.documentType] || d.documentType} · {d.documentId}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Issued {fmtDate(d.generatedAt)} · Template v{d.templateVersion}
                            {d.acknowledgedAt ? ` · Acknowledged ${fmtDate(d.acknowledgedAt)}` : ""}
                          </p>
                          {d.checksum && (
                            <p className="text-[10px] text-muted-foreground font-mono mt-1">
                              SHA-256 {d.checksum.slice(0, 16)}…
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <span className={`text-[10px] uppercase px-2 py-0.5 rounded-full font-medium ${statusClass(d.status)}`}>
                          {d.status}
                        </span>
                        <div className="flex items-center gap-2">
                          {needsAck && canAcknowledge && <AcknowledgeButton documentId={d.id} />}
                          {d.signedUrl && (
                            <a href={d.signedUrl} target="_blank" rel="noopener noreferrer">
                              <Button size="sm" variant="outline">
                                <Download className="w-3.5 h-3.5 mr-1" /> Download
                              </Button>
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                    {needsAck && (
                      <p className="text-xs text-amber-700 bg-amber-50 rounded-md px-3 py-2 mt-3">
                        This document requires acknowledgement by a partner owner or manager.
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
