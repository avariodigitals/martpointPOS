import { z } from "zod"
import { EMAIL_LAYOUTS, type EmailLayout } from "./email-layout"
import { htmlToText } from "./email-html"
import { sanitizeSupportHtml } from "./support-html"
import { defaultEmailFooter, ensureBrandedHtml, normalEmailHtml } from "./email-templates"
import { getEmailFooterSettings } from "./settings"

export const emailComposerFields = {
  layout: z.enum(EMAIL_LAYOUTS).optional(),
  bodyHtml: z.string().max(50000).refine(
    (value) => !!htmlToText(sanitizeSupportHtml(value)).trim(), "Write a message first",
  ).optional(),
}

/** Preview and delivery share the same document and selected layout. */
export async function renderCorrespondenceHtml(
  html: string, text: string, layout: EmailLayout,
  options: { eyebrow?: string; title?: string; signoff?: string } = {},
): Promise<string> {
  if (layout === "normal") return normalEmailHtml(html, { title: options.title })
  let footer = defaultEmailFooter()
  try { footer = await getEmailFooterSettings() } catch { /* Use configured defaults when settings are unavailable. */ }
  return ensureBrandedHtml(html, { ...options, text, footer })
}
