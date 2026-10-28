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
      "tbody",
      "tr",
      "td"
    ],
    allowedAttributes: {
      a: ["href", "target", "rel"],
      img: ["src", "alt", "width", "height"],
      "*": ["style"]
    },
    allowedSchemes: ["https", "http", "mailto", "tel"],
    allowedStyles: {
      "*": {
        "text-align": [/^(left|right|center|justify)$/],
        color: [/^#[0-9a-f]{3,8}$/i],
        "font-weight": [/^(bold|normal|[1-9]00)$/],
        "text-decoration": [/^(underline|line-through)$/]
      }
    },
    transformTags: { a: sanitizeHtml.simpleTransform("a", { target: "_blank", rel: "noopener noreferrer" }) }
  })
}
