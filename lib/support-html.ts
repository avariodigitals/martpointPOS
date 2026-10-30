import sanitizeHtml from "sanitize-html"

/** Rich replies use the free editor's semantic tags; no executable HTML. */
export function sanitizeSupportHtml(value: string): string {
  return sanitizeHtml(value, {
    allowedTags: [
      "p",
      "br",
      "strong",
      "b",
      "em",
      "i",
      "u",
      "s",
      "h2",
      "h3",
      "h1",
      "h4",
      "ul",
      "ol",
      "li",
      "blockquote",
      "pre",
      "code",
      "hr",
      "a",
      "div",
      "span",
      "img",
      "table",
      "thead",
      "tbody",
      "tfoot",
      "tr",
      "td",
      "th",
      "font"
    ],
    allowedAttributes: {
      a: ["href", "target", "rel"],
      img: ["src", "alt", "width", "height"],
      font: ["color", "size", "face"],
      table: ["width", "height", "cellpadding", "cellspacing", "border", "align", "role"],
      td: ["width", "height", "colspan", "rowspan", "align", "valign"],
      th: ["width", "height", "colspan", "rowspan", "align", "valign"],
      "*": ["style"]
    },
    allowedSchemes: ["https", "http", "mailto", "tel"],
    // Inline raster images are useful for signatures copied from Outlook. Keep
    // data: scoped to <img> and reject SVG or non-base64 payloads.
    allowedSchemesByTag: { img: ["https", "http", "data"] },
    exclusiveFilter: (frame) => frame.tag === "img" && /^data:/i.test(frame.attribs.src || "") && !/^data:image\/(?:png|jpe?g|gif|webp);base64,/i.test(frame.attribs.src || ""),
    allowedStyles: {
      "*": {
        "text-align": [/^(left|right|center|justify)$/],
        color: [/^(#[0-9a-f]{3,8}|rgba?\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+(?:\s*,\s*[\d.]+)?\s*\)|[a-z]{1,24})$/i],
        "background-color": [/^(#[0-9a-f]{3,8}|rgba?\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+(?:\s*,\s*[\d.]+)?\s*\)|transparent|[a-z]{1,24})$/i],
        "font-weight": [/^(bold|normal|[1-9]00)$/],
        "font-style": [/^(normal|italic|oblique)$/],
        "font-size": [/^(?:[0-9]{1,3}(?:\.[0-9]+)?)(?:px|pt|em|rem|%)$/],
        "font-family": [/^[a-z0-9 ,'-]{1,100}$/i],
        "text-decoration": [/^(underline|line-through|none)$/],
        "vertical-align": [/^(top|middle|bottom|baseline)$/],
        "line-height": [/^(?:[0-9]+(?:\.[0-9]+)?(?:px|pt|em|rem|%)?)$/],
        "border-collapse": [/^(collapse|separate)$/],
        display: [/^(block|inline|inline-block|table|table-cell|table-row)$/],
        "white-space": [/^(normal|nowrap|pre|pre-wrap)$/],
        "border-radius": [/^(?:[0-9]{1,3}px|[0-9]{1,3}%)(?:\s+(?:[0-9]{1,3}px|[0-9]{1,3}%)){0,3}$/],
        width: [/^(?:[0-9]{1,4}(?:px|pt|em|rem|%))$/],
        "max-width": [/^(?:[0-9]{1,4}(?:px|pt|em|rem|%))$/],
        height: [/^(?:[0-9]{1,4}(?:px|pt|em|rem|%)|auto)$/],
        border: [/^(?:[0-9]{1,2}px\s+(?:solid|dashed|dotted)\s+(?:#[0-9a-f]{3,8}|[a-z]{1,24}))$/i],
        "border-top": [/^(?:[0-9]{1,2}px\s+(?:solid|dashed|dotted)\s+(?:#[0-9a-f]{3,8}|[a-z]{1,24}))$/i],
        "border-right": [/^(?:[0-9]{1,2}px\s+(?:solid|dashed|dotted)\s+(?:#[0-9a-f]{3,8}|[a-z]{1,24}))$/i],
        "border-bottom": [/^(?:[0-9]{1,2}px\s+(?:solid|dashed|dotted)\s+(?:#[0-9a-f]{3,8}|[a-z]{1,24}))$/i],
        "border-left": [/^(?:[0-9]{1,2}px\s+(?:solid|dashed|dotted)\s+(?:#[0-9a-f]{3,8}|[a-z]{1,24}))$/i],
        padding: [/^(?:0|[0-9]{1,3}px)(?:\s+(?:0|[0-9]{1,3}px)){0,3}$/],
        "padding-left": [/^(?:0|[0-9]{1,3}px)$/],
        "padding-right": [/^(?:0|[0-9]{1,3}px)$/],
        "padding-top": [/^(?:0|[0-9]{1,3}px)$/],
        "padding-bottom": [/^(?:0|[0-9]{1,3}px)$/],
        margin: [/^(?:0|[0-9]{1,3}px|auto)(?:\s+(?:0|[0-9]{1,3}px|auto)){0,3}$/],
        "margin-top": [/^(?:0|[0-9]{1,3}px|auto)$/],
        "margin-right": [/^(?:0|[0-9]{1,3}px|auto)$/],
        "margin-bottom": [/^(?:0|[0-9]{1,3}px|auto)$/],
        "margin-left": [/^(?:0|[0-9]{1,3}px|auto)$/]
      }
    },
    transformTags: { a: sanitizeHtml.simpleTransform("a", { target: "_blank", rel: "noopener noreferrer" }) }
  })
}
