import Link from "next/link"
import { notFound } from "next/navigation"
import { requireCreatorSession } from "@/lib/creator-auth"
import { getResourceById } from "@/lib/creator-resources"
import { trackCreatorEvent } from "@/lib/creator-analytics"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Download } from "lucide-react"

export const dynamic = "force-dynamic"

/* Renders the same CMS body markup that lib/creator-doc-pdf.ts turns into the
 * branded PDF — one source of truth for View Online and Download PDF. */
function DocBody({ body }: { body: string }) {
  const blocks: React.ReactNode[] = []
  const lines = body.split(/\r?\n/)
  let key = 0

  const isTableRow = (l: string) => {
    const t = l.trim()
    return t.startsWith("|") && t.endsWith("|") && t.length > 2
  }
  const isSeparator = (l: string) => /^\|[\s:|-]+\|?$/.test(l.trim())
  const cells = (l: string) => l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim())

  let i = 0
  while (i < lines.length) {
    const line = lines[i].trim()
    if (!line) { i++; continue }

    if (line.startsWith("## ")) {
      blocks.push(<h3 key={key++} className="text-base font-semibold mt-6 mb-2">{line.slice(3)}</h3>)
      i++
    } else if (line.startsWith("# ")) {
      blocks.push(<h2 key={key++} className="text-lg font-bold text-retail mt-8 mb-3 pb-2 border-b border-retail/30">{line.slice(2)}</h2>)
    } else if (line.startsWith("> ")) {
      const buf: string[] = []
      while (i < lines.length && lines[i].trim().startsWith("> ")) {
        buf.push(lines[i].trim().slice(2))
        i++
      }
      blocks.push(
        <div key={key++} className="my-4 rounded-md border-l-4 border-retail bg-blue-50 px-4 py-3 text-sm text-blue-900">
          {buf.join(" ")}
        </div>
      )
      continue
    } else if (isTableRow(line)) {
      const rows: string[][] = []
      while (i < lines.length && isTableRow(lines[i])) {
        if (!isSeparator(lines[i])) rows.push(cells(lines[i]))
        i++
      }
      const [head, ...rest] = rows
      blocks.push(
        <div key={key++} className="my-4 overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-retail text-white text-left">
                {head.map((c, j) => <th key={j} className="px-3 py-2 font-medium">{c}</th>)}
              </tr>
            </thead>
            <tbody>
              {rest.map((r, ri) => (
                <tr key={ri} className={ri % 2 ? "bg-muted/40" : ""}>
                  {r.map((c, j) => <td key={j} className="px-3 py-2 align-top">{c}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
      continue
    } else if (line.startsWith("- ")) {
      const items: string[] = []
      while (i < lines.length && lines[i].trim().startsWith("- ")) {
        items.push(lines[i].trim().slice(2))
        i++
      }
      blocks.push(
        <ul key={key++} className="my-3 list-disc pl-6 space-y-1.5 text-sm">
          {items.map((t, j) => <li key={j}>{t}</li>)}
        </ul>
      )
      continue
    } else if (/^\d+[.)]\s/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\d+[.)]\s/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+[.)]\s/, ""))
        i++
      }
      blocks.push(
        <ol key={key++} className="my-3 list-decimal pl-6 space-y-1.5 text-sm">
          {items.map((t, j) => <li key={j}>{t}</li>)}
        </ol>
      )
      continue
    } else {
      const para: string[] = []
      while (
        i < lines.length && lines[i].trim() !== "" &&
        !lines[i].trim().startsWith("#") && !lines[i].trim().startsWith("> ") &&
        !lines[i].trim().startsWith("- ") && !isTableRow(lines[i]) &&
        !/^\d+[.)]\s/.test(lines[i].trim()) && !/^!\[/.test(lines[i].trim())
      ) {
        para.push(lines[i].trim())
        i++
      }
      blocks.push(<p key={key++} className="my-3 text-sm leading-relaxed">{para.join(" ")}</p>)
      continue
    }
    i++
  }
  return <>{blocks}</>
}

export default async function CreatorResourcePage({ params }: { params: Promise<{ id: string }> }) {
  const { creator } = await requireCreatorSession()
  const { id } = await params
  const resource = await getResourceById(id)
  if (!resource || !resource.active || !resource.body) notFound()

  void trackCreatorEvent(creator.id, "RESOURCE_VIEWED", { type: "resource", id: resource.id })

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/creator/kit"><ArrowLeft className="w-4 h-4 mr-1" /> Creator Kit</Link>
        </Button>
        {resource.pdfEnabled && (
          <Button size="sm" asChild>
            <a href={`/api/creator/resources/${resource.id}/pdf`} target="_blank" rel="noopener noreferrer">
              <Download className="w-4 h-4 mr-1.5" /> Download PDF
            </a>
          </Button>
        )}
      </div>

      <div>
        <h2 className="text-2xl font-bold tracking-tight">{resource.name}</h2>
        <p className="text-xs text-muted-foreground mt-1">
          {resource.version ? `Version ${resource.version} · ` : ""}Official MartPoint Creator Network document
        </p>
      </div>

      <Card>
        <CardContent className="p-6 sm:p-8">
          <DocBody body={resource.body} />
        </CardContent>
      </Card>

      {resource.usageNotes && (
        <p className="text-xs text-amber-700 bg-amber-50 rounded-md px-3 py-2">{resource.usageNotes}</p>
      )}
    </div>
  )
}
