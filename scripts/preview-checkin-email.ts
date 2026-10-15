/* One-off preview: renders real founder check-in emails to a local HTML file.
 * Run: npx tsx scripts/preview-checkin-email.ts */
import fs from "fs"
import path from "path"
import { EMAIL_TEMPLATES } from "../lib/email-templates"

const PUB = path.resolve(__dirname, "..", "public")

// Handwritten-looking stand-in; in production this slot holds the uploaded photo.
const sigSvg = `<svg xmlns='http://www.w3.org/2000/svg' width='220' height='80'><text x='12' y='56' font-family="Snell Roundhand, Brush Script MT, cursive" font-size='46' fill='#101010'>Ralph</text><path d='M14 66 C 70 78, 150 74, 204 62' stroke='#101010' stroke-width='2.4' fill='none' stroke-linecap='round'/></svg>`
const signatureBlock = `<img src="data:image/svg+xml;base64,${Buffer.from(sigSvg).toString("base64")}" alt="Ralph" width="180" style="display:block;max-width:180px;height:auto;margin:0 0 6px;" />`

function render(key: string): { subject: string; html: string } {
  const tpl = EMAIL_TEMPLATES.find((t) => t.key === key)
  if (!tpl) throw new Error(`Template ${key} not found`)
  let html = tpl.html || tpl.text
  const vars: Record<string, string> = {
    fullName: "Ada",
    businessName: "Ada's Fresh Mart",
    founderName: "Ralph",
    signatureBlock,
  }
  for (const [k, v] of Object.entries(vars)) html = html.split(`{{${k}}}`).join(v)
  // Point site assets (flower garland, logo) at the local public/ folder.
  html = html.replace(/https:\/\/martpoint\.com\.ng\//g, `file://${PUB}/`)
  return { subject: tpl.subject.replace(/{{(\w+)}}/g, (_, k) => vars[k] ?? ""), html }
}

for (const key of ["client_welcome", "client_checkin_30", "client_anniversary"]) {
  const { html } = render(key)
  const out = `/tmp/mp-email-${key}.html`
  fs.writeFileSync(out, html)
  console.log("Wrote", out)
}

const frames = ["client_welcome", "client_checkin_30", "client_anniversary"].map((key) => {
  const { subject, html } = render(key)
  const srcdoc = html.replace(/&/g, "&amp;").replace(/"/g, "&quot;")
  return `<div style="max-width:680px;margin:0 auto 40px;">
    <p style="font:600 14px/1.4 -apple-system,sans-serif;color:#111;margin:0 0 2px;">Subject: ${subject.replace(/&/g, "&amp;")}</p>
    <p style="font:12px/1.4 -apple-system,sans-serif;color:#777;margin:0 0 8px;">Reply-To: Ralph at MartPoint &lt;ralph@martpoint.com.ng&gt;</p>
    <iframe onload="this.style.height=(this.contentDocument.body.scrollHeight+30)+'px'" srcdoc="${srcdoc}" style="width:100%;border:1px solid #ddd;border-radius:10px;background:#fff;"></iframe>
  </div>`
}).join("\n")

const page = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>MartPoint check-in email preview</title></head>
<body style="background:#ececf1;padding:32px 16px;font-family:-apple-system,sans-serif;">
<p style="max-width:680px;margin:0 auto 24px;font:13px/1.6 -apple-system,sans-serif;color:#444;background:#fffbe6;border:1px solid #f0e0a0;border-radius:8px;padding:10px 14px;">
PREVIEW only. The cursive &ldquo;Ralph&rdquo; stands in for the signature <b>photo you upload</b> in Settings &rarr; Client Check-ins; the image clients see is your actual handwriting (typed name stays if their mail app blocks images).</p>
${frames}
</body></html>`

const out = "/tmp/martpoint-email-preview.html"
fs.writeFileSync(out, page)
console.log("Wrote", out)
