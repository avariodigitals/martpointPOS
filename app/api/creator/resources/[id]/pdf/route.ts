import { NextResponse } from "next/server"
import { authorizeCreator } from "@/lib/creator-auth"
import { getResourceById } from "@/lib/creator-resources"
import { generateCreatorDocPdf } from "@/lib/creator-doc-pdf"
import { trackCreatorEvent } from "@/lib/creator-analytics"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"

export const dynamic = "force-dynamic"

/**
 * GET /api/creator/resources/[id]/pdf — renders an ARTICLE resource's CMS body
 * through the shared MartPoint PDF design system and streams the file.
 */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { creator, denied } = await authorizeCreator()
  if (denied) return denied
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Not configured" }, { status: 503 })
  }
  const { id } = await params

  const resource = await getResourceById(id)
  if (!resource || !resource.active) {
    return NextResponse.json({ error: "Resource not found" }, { status: 404 })
  }
  if (!resource.pdfEnabled || !resource.body) {
    return NextResponse.json({ error: "PDF download is not available for this resource" }, { status: 400 })
  }

  const pdf = generateCreatorDocPdf({
    title: resource.name,
    version: resource.version,
    body: resource.body,
    footerRef: `MartPoint Creator Network — ${resource.name}${resource.version ? ` v${resource.version}` : ""} — martpoint.com.ng`,
  })

  void trackCreatorEvent(creator.id, "RESOURCE_DOWNLOADED",
    { type: "resource", id: resource.id },
    { format: "pdf" })
  void supabase
    .from("creator_resources")
    .update({ download_count: resource.downloadCount + 1 })
    .eq("id", resource.id)
    .then(() => {})

  return new Response(new Uint8Array(pdf.bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${pdf.fileName}"`,
      "Cache-Control": "private, no-store",
    },
  })
}
