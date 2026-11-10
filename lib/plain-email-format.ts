import { escapeHtml } from "@/lib/email-html"

function inlineEmailMarkup(value: string): string {
  let html = escapeHtml(value)
  html = html
    .replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>")
    .replace(/__([^_\n]+)__/g, "<strong>$1</strong>")
    .replace(/\*([^*\n]+)\*/g, "<em>$1</em>")
    .replace(/_([^_\n]+)_/g, "<em>$1</em>")
    .replace(/`([^`\n]+)`/g, "<code>$1</code>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
  return html.replace(/https?:\/\/[^\s<]+/g, (url) => {
    const punctuation = url.match(/[.,!?;:)\]}]+$/)?.[0] || ""
    const href = punctuation ? url.slice(0, -punctuation.length) : url
    return `<a href="${href}" target="_blank" rel="noopener noreferrer">${href}</a>${punctuation}`
  })
}

/** Render reply text as safe, readable email content when a sender has no HTML part. */
export function plainEmailToHtml(input: string): string {
  const lines = input.replace(/\r\n?/g, "\n").replace(/\u0000/g, "").split("\n")
  const blocks: string[] = []
  let paragraph: string[] = []
  let quote: string[] = []
  let list: { ordered: boolean; items: string[] } | null = null
  let table: string[][] = []

  const flushParagraph = () => {
    if (paragraph.length) blocks.push(`<p>${paragraph.map(inlineEmailMarkup).join("<br>")}</p>`)
    paragraph = []
  }
  const flushQuote = () => {
    if (quote.length) blocks.push(`<blockquote>${quote.map(inlineEmailMarkup).join("<br>")}</blockquote>`)
    quote = []
  }
  const flushList = () => {
    if (list) {
      const tag = list.ordered ? "ol" : "ul"
      blocks.push(`<${tag}>${list.items.map((item) => `<li>${inlineEmailMarkup(item)}</li>`).join("")}</${tag}>`)
    }
    list = null
  }
  const flushTable = () => {
    if (table.length) {
      const [heading, ...rows] = table
      blocks.push(`<table><thead><tr>${heading.map((cell) => `<th>${inlineEmailMarkup(cell)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${inlineEmailMarkup(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table>`)
    }
    table = []
  }
  const flushFlow = () => { flushParagraph(); flushQuote(); flushList(); flushTable() }

  for (const rawLine of lines) {
    const line = rawLine.trimEnd()
    const quoteMatch = line.match(/^\s*>+\s?(.*)$/)
    if (quoteMatch) {
      flushParagraph(); flushList(); flushTable()
      quote.push(quoteMatch[1])
      continue
    }
    if (!line.trim()) { flushFlow(); continue }
    flushQuote()

    if (/^\s*[-*_]{3,}\s*$/.test(line)) { flushFlow(); blocks.push("<hr>"); continue }
    const heading = line.match(/^\s{0,3}(#{1,3})\s+(.+)$/)
    if (heading) { flushFlow(); const level = heading[1].length; blocks.push(`<h${level}>${inlineEmailMarkup(heading[2])}</h${level}>`); continue }

    const tableCells = line.trim().startsWith("|") && line.trim().endsWith("|")
      ? line.trim().slice(1, -1).split("|").map((cell) => cell.trim())
      : null
    if (tableCells && !/^[-:\s]+$/.test(tableCells.join(""))) {
      flushParagraph(); flushList(); table.push(tableCells); continue
    }
    if (table.length) flushTable()

    const listMatch = line.match(/^\s*(?:([-+*])|(\d+)[.)])\s+(.+)$/)
    if (listMatch) {
      flushParagraph()
      const ordered = Boolean(listMatch[2])
      if (list && list.ordered !== ordered) flushList()
      if (!list) list = { ordered, items: [] }
      list.items.push(listMatch[3])
      continue
    }
    flushList()
    paragraph.push(line.trim())
  }
  flushFlow()

  return `<div class="formatted-plain-email">${blocks.join("") || "<p></p>"}</div>`
}
