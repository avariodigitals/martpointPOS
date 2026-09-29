// Generates MartPoint_SEO_Action_Plan.pdf in the repo root.
// Run: node scripts/generate-seo-action-plan.mjs
import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"

const doc = new jsPDF({ unit: "pt", format: "a4" })
const W = doc.internal.pageSize.getWidth()
const M = 48
let y = 56

const navy = [2, 48, 71]
const retail = [13, 148, 136]
const gray = [90, 90, 90]

function h1(text) {
  doc.setFont("helvetica", "bold").setFontSize(20).setTextColor(...navy)
  doc.text(text, M, y)
  y += 14
}
function h2(text) {
  y += 18
  doc.setFont("helvetica", "bold").setFontSize(13).setTextColor(...retail)
  doc.text(text.toUpperCase(), M, y)
  y += 8
  doc.setDrawColor(...retail).setLineWidth(0.75).line(M, y, W - M, y)
  y += 14
}
function body(text) {
  doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(40, 40, 40)
  const lines = doc.splitTextToSize(text, W - 2 * M)
  for (const line of lines) {
    if (y > doc.internal.pageSize.getHeight() - 60) { doc.addPage(); y = 56 }
    doc.text(line, M, y); y += 14
  }
}
function bullet(text) {
  doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(40, 40, 40)
  const lines = doc.splitTextToSize(text, W - 2 * M - 14)
  lines.forEach((line, i) => {
    if (y > doc.internal.pageSize.getHeight() - 60) { doc.addPage(); y = 56 }
    if (i === 0) { doc.setTextColor(...retail); doc.text("•", M, y); doc.setTextColor(40, 40, 40) }
    doc.text(line, M + 14, y); y += 14
  })
}
function table(head, rows) {
  autoTable(doc, {
    startY: y,
    head: [head],
    body: rows,
    margin: { left: M, right: M },
    styles: { fontSize: 9, cellPadding: 5 },
    headStyles: { fillColor: navy, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [245, 248, 250] },
    theme: "grid",
  })
  y = doc.lastAutoTable.finalY + 6
}

// ─── Header ────────────────────────────────────────────────
h1("MartPoint SEO — Action Plan")
doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(...gray)
doc.text("Prepared 29 September 2026 · martpoint.com.ng", M, y)
y += 8
doc.setDrawColor(220, 220, 220).line(M, y, W - M, y)
y += 10

// ─── Done ──────────────────────────────────────────────────
h2("Completed (technical fixes — already in the codebase)")
bullet("Canonical bug fixed — 43 industry pages no longer inherit the homepage canonical; all 50 industry pages now self-canonicalize.")
bullet("Canonical domain normalized to https://martpoint.com.ng everywhere (metadataBase, sitemap, robots, schema, OG URLs).")
bullet("'in Nigeria' added to all 50 industry page titles and key pages (home, MartPoint Retail, Pricing, ERP, Why MartPoint, Industries index).")
bullet("New /industries/bars-and-lounges page — closes the last Priority-2 keyword gap.")

h2("After you deploy")
bullet("Verify rendered HTML on e.g. /industries/bakeries: <link rel=\"canonical\"> must point to itself, og:url must be martpoint.com.ng.")
bullet("Resubmit sitemap.xml in Google Search Console and request indexing on the updated industry pages.")
bullet("Confirm the host redirects www.martpoint.com.ng → martpoint.com.ng (one canonical host, 301).")

// ─── P1 content ────────────────────────────────────────────
h2("Content to publish — Priority 1 (high buying intent)")
table(["Content", "Target keyword", "Suggested URL"], [
  ["Buyer's guide / comparison", "best POS software in Nigeria", "/blog/best-pos-software-in-nigeria"],
  ["Small business article", "POS software for small business in Nigeria", "/blog/pos-software-small-business-nigeria"],
  ["Feature-focused article", "POS and inventory software in Nigeria", "/blog/pos-and-inventory-software-nigeria"],
  ["Connectivity guide", "cloud / offline POS software in Nigeria", "/blog/cloud-vs-offline-pos-nigeria"],
  ["Transparent cost guide", "POS software price in Nigeria", "/blog/pos-system-cost-nigeria"],
  ["Hardware + software setup cost", "complete POS system price in Nigeria", "/blog/complete-pos-system-price-nigeria"],
])
body("Link each article to /pricing, /estimate and the relevant industry page. Keep one page per intent — do not create multiple articles competing for 'POS software in Nigeria'.")

// ─── FAQs ──────────────────────────────────────────────────
h2("Expand /faqs — add these questions (verbatim phrasing)")
table(["Missing question", "Answers the search"], [
  ["What is POS software?", "What is POS software"],
  ["What is the difference between a POS machine and POS software?", "POS machine vs software"],
  ["Can POS software work without internet?", "offline POS"],
  ["Can I monitor my shop from my phone?", "remote monitoring"],
  ["Can POS software track staff sales?", "staff sales tracking"],
  ["Can POS software prevent employee theft?", "employee theft"],
  ["Can I import my products from Excel?", "Excel import"],
  ["What equipment do I need for a POS system?", "hardware requirements"],
  ["Does POS software work on a phone?", "mobile POS"],
  ["What is the best POS system for a small shop?", "small shop POS"],
  ["Is there free POS software in Nigeria?", "free POS"],
  ["What is the difference between cloud and offline POS?", "cloud vs offline"],
  ["How does POS software manage inventory?", "inventory management"],
  ["Can a POS system track customer debt?", "credit/debt tracking"],
])
body("Add these in the admin FAQ manager (Supabase faqs table). The /faqs page already emits FAQPage schema, so new entries get rich-result eligibility automatically.")

// ─── P4 blog ───────────────────────────────────────────────
h2("Blog articles — Priority 4 (problem-based searches)")
table(["Article idea", "Problem it captures"], [
  ["How to prevent stock loss in your shop", "stock loss / shrinkage"],
  ["How to monitor cashier activities remotely", "cashier monitoring"],
  ["How to manage supermarket inventory", "supermarket inventory"],
  ["How to know your daily profit without spreadsheets", "daily profit"],
  ["How to track credit sales and customer debt", "credit sales / debt"],
  ["How to manage multiple shop branches from one place", "multi-branch"],
  ["How to stop staff from changing prices", "price tampering"],
  ["How to track products with barcodes", "barcode tracking"],
  ["How to move your shop inventory from Excel to software", "Excel migration"],
  ["How to get low-stock alerts before you run out", "low-stock alerts"],
  ["How to manage your retail business remotely", "remote management"],
  ["How to manage product variants (sizes, colours)", "variants"],
  ["How to track expiry dates in a pharmacy", "expiry tracking"],
  ["How to manage supplier orders and deliveries", "supplier orders"],
])
body("Each article should end by linking to the matching /industries/* page and /martpoint-retail. Aim for a steady cadence — one or two posts per week is enough.")

// ─── Optional polish ───────────────────────────────────────
h2("Optional polish (lower priority)")
bullet("Add per-page openGraph title/url to industry template pages — they currently inherit the homepage OG block.")
bullet("Work 'POS software in Nigeria' phrasing into the H1 or hero subcopy of / and /martpoint-retail (titles already carry it).")
bullet("Consider LocalBusiness schema fields (address, geo) if you want local-pack visibility in Lagos.")

doc.save("MartPoint_SEO_Action_Plan.pdf")
console.log("Wrote MartPoint_SEO_Action_Plan.pdf")
