import { readFileSync } from "fs"
import path from "path"
import { PartnerDocBuilder, type GeneratedPdf } from "./partner-pdf"

/* ───────────────────────────  Creator document PDFs  ───────────────────────────
 * Renders CMS-managed document bodies (creator_resources.body) through the same
 * PartnerDocBuilder letterhead/footer/typography used by partner agreements and
 * generated docs — no separate Creator PDF design language.
 *
 * Body markup (kept intentionally small — a safe subset for admins):
 *   # Heading            → branded blue heading with rule
 *   ## Sub-heading       → bold section label
 *   - item               → bullet (hanging indent)
 *   1. item              → numbered item
 *   > text               → highlighted callout box
 *   | a | b |            → table row (first row = header; |---| separators ignored)
 *   ![caption](path)     → image from public/ or an absolute https URL already
 *                          embedded server-side (skipped gracefully if unreadable)
 *   anything else        → body paragraph (consecutive lines merge)
 */

let logoCache: string | null | undefined

/** Brand logo as a PNG data URL (server-side read of public/logo.png). */
export function getBrandLogoDataUrl(): string | undefined {
  if (logoCache !== undefined) return logoCache ?? undefined
  try {
    const buf = readFileSync(path.join(process.cwd(), "public", "logo.png"))
    logoCache = `data:image/png;base64,${buf.toString("base64")}`
  } catch {
    logoCache = null
  }
  return logoCache ?? undefined
}

function isTableRow(line: string): boolean {
  const t = line.trim()
  return t.startsWith("|") && t.endsWith("|") && t.length > 2
}
function isTableSeparator(line: string): boolean {
  return /^\|[\s:|-]+\|?$/.test(line.trim())
}
function tableCells(line: string): string[] {
  return line.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim())
}

/** Public-path image → PNG data URL, or null when unavailable/unsupported. */
function loadPublicImage(src: string): string | null {
  // Only local public assets are loaded — no remote fetching at render time.
  if (!src.startsWith("/")) return null
  const file = path.join(process.cwd(), "public", src.replace(/^\/+/, ""))
  const ext = path.extname(file).toLowerCase()
  const mime = ext === ".png" ? "image/png" : ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : null
  if (!mime) return null // webp/svg etc. are skipped rather than breaking the PDF
  try {
    return `data:${mime};base64,${readFileSync(file).toString("base64")}`
  } catch {
    return null
  }
}

export function renderDocBody(builder: PartnerDocBuilder, body: string) {
  const lines = body.split(/\r?\n/)
  let i = 0
  let listCounter = 0

  while (i < lines.length) {
    const raw = lines[i]
    const line = raw.trim()

    if (!line) { i++; listCounter = 0; continue }

    if (line.startsWith("## ")) {
      builder.subHeading(line.slice(3).trim())
      i++; listCounter = 0
      continue
    }
    if (line.startsWith("# ")) {
      builder.heading(line.slice(2).trim())
      i++; listCounter = 0
      continue
    }
    if (line.startsWith("> ")) {
      const buf: string[] = []
      while (i < lines.length && lines[i].trim().startsWith("> ")) {
        buf.push(lines[i].trim().slice(2).trim())
        i++
      }
      builder.callout(buf.join(" "))
      listCounter = 0
      continue
    }
    if (isTableRow(line)) {
      const rows: string[][] = []
      while (i < lines.length && isTableRow(lines[i])) {
        if (!isTableSeparator(lines[i])) rows.push(tableCells(lines[i]))
        i++
      }
      if (rows.length) {
        const [head, ...rest] = rows
        builder.table(head, rest.length ? rest : [[]])
      }
      listCounter = 0
      continue
    }
    const imgMatch = line.match(/^!\[(.*?)\]\(([^)]+)\)$/)
    if (imgMatch) {
      const dataUrl = loadPublicImage(imgMatch[2])
      if (dataUrl) builder.image(dataUrl, { caption: imgMatch[1] || undefined })
      i++
      continue
    }
    if (line.startsWith("- ")) {
      builder.listItem(line.slice(2).trim())
      i++
      continue
    }
    const numMatch = line.match(/^(\d+)[.)]\s+(.*)$/)
    if (numMatch) {
      listCounter = Number(numMatch[1])
      builder.listItem(numMatch[2].trim(), { marker: `${listCounter}.` })
      i++
      continue
    }

    // Merge consecutive plain lines into one paragraph.
    const paraLines: string[] = []
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !lines[i].trim().startsWith("#") &&
      !lines[i].trim().startsWith("> ") &&
      !lines[i].trim().startsWith("- ") &&
      !isTableRow(lines[i]) &&
      !/^!\[/.test(lines[i].trim()) &&
      !/^\d+[.)]\s/.test(lines[i].trim())
    ) {
      paraLines.push(lines[i].trim())
      i++
    }
    if (paraLines.length) builder.para(paraLines.join(" "))
    listCounter = 0
  }
}

export function generateCreatorDocPdf(opts: {
  title: string
  version?: string | null
  body: string
  footerRef: string
}): GeneratedPdf {
  const builder = new PartnerDocBuilder({
    logoDataUrl: getBrandLogoDataUrl(),
    footerRef: opts.footerRef,
  })
  builder.title(opts.title, opts.version ? `Version ${opts.version}` : "MartPoint Creator Network")
  renderDocBody(builder, opts.body)
  const safe = opts.title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "")
  return builder.finish(`${safe}.pdf`)
}
