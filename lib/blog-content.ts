// Utilities that turn blog post HTML into SEO-friendly output:
//  - Bare URL text (https://..., www....) becomes real <a> backlinks
//  - External anchors get target="_blank" rel="noopener noreferrer"
//  - Internal links (martpoint.com.ng or relative paths) stay dofollow
// Works on plain strings so it runs both server-side (post render) and
// client-side (editor).

const SITE_HOST = (
  process.env.NEXT_PUBLIC_SITE_HOST || "martpoint.com.ng"
).toLowerCase()

export const escapeHtmlText = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

const URL_TEXT_RE = /\b(?:https?:\/\/|www\.)[^\s<>"'“”‘’]+/gi
const ENTITY_SUFFIX_RE = /(?:&(?:quot|apos|lt|gt|nbsp|hellip|mdash|ndash|laquo|raquo|copy|reg|trade)|&#\d+);?$/i
const TRAILING_PUNCT_RE = /[.,;:!?)\]]+$/
const SKIP_TEXT_TAGS = new Set(["script", "style", "textarea", "code", "pre"])

export function isInternalHref(href: string): boolean {
  const trimmed = href.trim()
  if (!trimmed) return true
  if (/^(mailto:|tel:)/i.test(trimmed)) return true
  if (trimmed.startsWith("/") || trimmed.startsWith("#") || trimmed.startsWith("?")) return true
  try {
    const host = new URL(trimmed).hostname.toLowerCase()
    return host === SITE_HOST || host === `www.${SITE_HOST}` || host.endsWith(`.${SITE_HOST}`)
  } catch {
    return true
  }
}

export function normalizeHref(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return trimmed
  if (/^(https?:|mailto:|tel:|ftp:|#|\/)/i.test(trimmed)) return trimmed
  if (/^www\./i.test(trimmed)) return `https://${trimmed}`
  // Bare domain, e.g. "example.com/page" or "martpoint.com.ng/x" -> https://...
  if (/^[^\s/]+\.[a-zA-Z]{2,}([/?#:]|$)/.test(trimmed)) return `https://${trimmed}`
  return trimmed
}

function linkAttrs(href: string): string {
  return isInternalHref(href) ? "" : ' target="_blank" rel="noopener noreferrer"'
}

function linkifyTextNode(text: string): string {
  return text.replace(URL_TEXT_RE, (match) => {
    let url = match.replace(ENTITY_SUFFIX_RE, "")
    const trailing = (TRAILING_PUNCT_RE.exec(url)?.[0]) ?? ""
    url = url.slice(0, url.length - trailing.length)
    if (!url || !/\./.test(url)) return match
    const href = normalizeHref(url)
    return `<a href="${href}"${linkAttrs(href)}>${url}</a>${trailing}`
  })
}

// Adds SEO attributes to an existing <a ...> tag string.
function enhanceAnchorTag(tag: string): string {
  const hrefMatch = /\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(tag)
  const href = hrefMatch?.[1] ?? hrefMatch?.[2] ?? hrefMatch?.[3] ?? ""
  if (!href || !hrefMatch) return tag
  const normalized = normalizeHref(href)
  let out = normalized !== href ? tag.replace(hrefMatch[0], (s) => s.replace(href, normalized)) : tag
  if (isInternalHref(normalized)) return out

  const insert = (attr: string) => {
    out = out.replace(/\s*>$/, `${attr}>`)
  }
  if (!/\btarget\s*=/i.test(out)) insert(' target="_blank"')
  const relMatch = /\brel\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(out)
  if (relMatch) {
    const relValue = relMatch[1] ?? relMatch[2] ?? relMatch[3] ?? ""
    const tokens = new Set(relValue.toLowerCase().split(/\s+/).filter(Boolean))
    tokens.add("noopener")
    tokens.add("noreferrer")
    out = out.replace(relMatch[0], `rel="${[...tokens].join(" ")}"`)
  } else {
    insert(' rel="noopener noreferrer"')
  }
  return out
}

// Walks HTML, linkifying bare-URL text nodes (outside anchors and raw-text
// elements) and stamping SEO attributes on existing anchor tags.
export function processBlogContent(html: string): string {
  if (!html || (!/(https?:\/\/|www\.)/i.test(html) && !/<a\b/i.test(html))) return html

  const TAG_RE = /<!--[\s\S]*?-->|<\/?[a-zA-Z][\w:-]*(?:\s+(?:[^>"']|"[^"]*"|'[^']*')*)?\s*\/?>/g
  let result = ""
  let lastIndex = 0
  let skipDepth = 0 // inside script/style/code/pre/textarea
  let anchorDepth = 0 // inside <a> — never linkify its text
  let m: RegExpExecArray | null

  while ((m = TAG_RE.exec(html))) {
    const text = html.slice(lastIndex, m.index)
    result += skipDepth === 0 && anchorDepth === 0 ? linkifyTextNode(text) : text

    const tag = m[0]
    const isClose = tag.startsWith("</")
    const isSelfClose = /\/>$/.test(tag) || tag.startsWith("<!--")
    const name = (/^<\/?([a-zA-Z][\w:-]*)/.exec(tag)?.[1] ?? "").toLowerCase()

    if (skipDepth > 0) {
      // Inside a raw-text element: emit untouched, only track nesting
      if (!isClose && !isSelfClose && SKIP_TEXT_TAGS.has(name)) skipDepth++
      else if (isClose && SKIP_TEXT_TAGS.has(name)) skipDepth = Math.max(0, skipDepth - 1)
      result += tag
    } else if (anchorDepth > 0) {
      if (name === "a") {
        if (isClose) anchorDepth = Math.max(0, anchorDepth - 1)
        else if (!isSelfClose) anchorDepth++
      } else if (!isClose && !isSelfClose && SKIP_TEXT_TAGS.has(name)) {
        skipDepth++
      }
      result += tag
    } else if (name === "a" && !isClose) {
      result += enhanceAnchorTag(tag)
      if (!isSelfClose) anchorDepth++
    } else {
      if (!isClose && !isSelfClose && SKIP_TEXT_TAGS.has(name)) skipDepth++
      result += tag
    }
    lastIndex = m.index + tag.length
  }

  const tail = html.slice(lastIndex)
  result += skipDepth === 0 && anchorDepth === 0 ? linkifyTextNode(tail) : tail
  return result
}

// DOM variant used by the rich editor right after createLink / paste so the
// saved markup already carries correct hrefs and SEO attributes.
export function enhanceDomAnchors(root: ParentNode) {
  root.querySelectorAll<HTMLAnchorElement>("a[href]").forEach((a) => {
    const raw = a.getAttribute("href") || ""
    const href = normalizeHref(raw)
    if (href !== raw) a.setAttribute("href", href)
    if (isInternalHref(href)) return
    if (a.getAttribute("target") !== "_blank") a.setAttribute("target", "_blank")
    const rel = new Set((a.getAttribute("rel") || "").toLowerCase().split(/\s+/).filter(Boolean))
    rel.add("noopener")
    rel.add("noreferrer")
    a.setAttribute("rel", [...rel].join(" "))
  })
}
