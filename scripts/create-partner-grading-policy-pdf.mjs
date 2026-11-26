import fs from "node:fs"
import path from "node:path"
import { jsPDF } from "jspdf"

const out = path.resolve("public/partner-resources/MartPoint-Partner-Performance-Grading-Progression-Policy.pdf")
fs.mkdirSync(path.dirname(out), { recursive: true })
const doc = new jsPDF({ unit: "mm", format: "a4" })
const W = 210, H = 297, left = 18, right = 18, contentW = W - left - right
const blue = [31, 86, 255], ink = [25, 34, 52], muted = [94, 105, 126]
let y = 18, page = 1

function footer() {
  doc.setDrawColor(225, 230, 239); doc.line(left, H - 15, W - right, H - 15)
  doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...muted)
  doc.text("MP-POL-PGP-001  |  Version 1.0  |  Effective only upon Management approval", left, H - 9)
  doc.text(String(page), W - right, H - 9, { align: "right" })
}
function newPage() { footer(); doc.addPage(); page++; y = 20 }
function need(h) { if (y + h > H - 22) newPage() }
function title(text) {
  need(13); doc.setFont("helvetica", "bold"); doc.setFontSize(14); doc.setTextColor(...blue)
  doc.text(text, left, y); y += 8
}
function para(text, size = 9.5) {
  doc.setFont("helvetica", "normal"); doc.setFontSize(size); doc.setTextColor(...ink)
  const lines = doc.splitTextToSize(text, contentW); need(lines.length * 4.8 + 2)
  doc.text(lines, left, y); y += lines.length * 4.8 + 3
}
function bullets(items) {
  for (const item of items) { doc.setFont("helvetica", "normal"); doc.setFontSize(9.2); doc.setTextColor(...ink)
    const lines = doc.splitTextToSize(item, contentW - 7); need(lines.length * 4.6 + 1)
    doc.setFillColor(...blue); doc.circle(left + 1.5, y - 1.1, 0.7, "F"); doc.text(lines, left + 6, y); y += lines.length * 4.6 + 2
  }
}
function table(headers, rows, widths) {
  const rowH = 8
  need(rowH * (rows.length + 1) + 4)
  let x = left
  doc.setFillColor(...blue); doc.rect(left, y - 5, contentW, rowH, "F")
  doc.setFont("helvetica", "bold"); doc.setFontSize(8.5); doc.setTextColor(255, 255, 255)
  headers.forEach((v, i) => { doc.text(v, x + 2, y); x += widths[i] })
  y += rowH - 1
  rows.forEach((row, r) => {
    const cells = row.map((v, i) => doc.splitTextToSize(String(v), widths[i] - 4))
    const lines = Math.max(...cells.map(c => c.length)); const h = Math.max(rowH, lines * 4.3 + 3); need(h + 1)
    if (r % 2 === 0) { doc.setFillColor(244, 247, 251); doc.rect(left, y - 5, contentW, h, "F") }
    x = left; doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...ink)
    cells.forEach((cell, i) => { doc.text(cell, x + 2, y); x += widths[i] })
    y += h
  })
  y += 4
}

doc.setFillColor(247, 249, 255); doc.rect(0, 0, W, 70, "F")
doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(...blue); doc.text("MARTPOINT", left, 20)
doc.setFontSize(23); doc.setTextColor(...ink); doc.text("Partner Performance,", left, 36)
doc.text("Grading & Progression Policy", left, 47)
doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...muted)
doc.text("Document MP-POL-PGP-001  |  Version 1.0  |  Partner Resource", left, 57)
doc.setTextColor(154, 48, 21); doc.setFont("helvetica", "bold"); doc.text("EFFECTIVE ONLY UPON MANAGEMENT APPROVAL", left, 64)
y = 80

title("1. Purpose and starting status")
para("This policy explains how MartPoint Partners can earn performance recognition and progress through partner grades. Grade tracks are maintained separately for each approved Partner Type. Every new Partner starts Ungraded. Application approval, agreement signing, training, certification and onboarding do not award a grade.")
para("The 90-day activation and activity-monitoring period remains in place as a separate operational check. It is not a grade and does not by itself award Silver. Contractual commission and approved implementation fees remain available under their signed terms regardless of grade.")
title("2. Proposed grade thresholds")
table(["Grade", "Verified outcomes", "Minimum duration", "Assessment window"], [
  ["Silver", "1 qualifying outcome", "90 days", "At least one verified outcome"],
  ["Gold", "10 qualifying outcomes", "6 months", "Rolling 12 months"],
  ["Platinum", "25 qualifying outcomes", "12 months", "Rolling 12 months"],
], [30, 53, 42, 49])
para("Thresholds establish eligibility for a Management assessment, not an automatic award. Every grade also requires completed onboarding, applicable certification, satisfactory customer outcomes, satisfactory compliance, a performance review and written Management approval.")
title("3. What counts as an outcome")
title("Channel Partner")
bullets([
  "One distinct customer acquired through an accepted opportunity, with eligible subscription payment cleared and MartPoint licence activated.",
  "Several licences, branches or user seats for the same customer count as one outcome. Additional user seats and renewals are not new acquisition outcomes.",
  "Leads, meetings, demonstrations, quotations and free trials do not qualify on their own.",
])
title("Implementation Partner")
bullets([
  "One distinct customer implementation completed and formally accepted by MartPoint under an authorised Work Order.",
  "Repeated milestones or Work Orders for the same initial implementation do not create duplicate outcomes.",
  "Work without an approved Work Order, incomplete work and work not formally accepted do not qualify.",
])
para("Independent hardware or service sales do not count toward MartPoint grading. MartPoint verifies outcome records and prevents duplicate counting.")

newPage()
title("4. Benefits by grade")
table(["Ungraded", "Silver", "Gold", "Platinum"], [[
  "Partner Portal, approved resources, onboarding and eligibility for contractual earnings.",
  "Silver badge and certificate; eligible for public directory listing after approval.",
  "Silver benefits; priority consideration for suitable opportunities and joint marketing.",
  "Gold benefits; priority consideration for strategic opportunities, commercial reviews and roadmap engagement.",
]], [43, 43, 43, 45])
para("Opportunity priority is consideration only and does not guarantee leads, assignments, revenue, exclusivity or minimum work. Grades do not automatically increase commissions, fees or other commercial entitlements.")
title("5. Assessment, badge and directory controls")
bullets([
  "MartPoint calculates progress from verified payment, activation and accepted Work Order records. Partners cannot declare their own qualifying outcomes.",
  "Management reviews evidence, duration, onboarding, applicable certification, customer outcomes and compliance before deciding.",
  "A badge, certificate or public listing may be used only after the relevant grade and directory eligibility are formally approved.",
  "For Partners with multiple appointments, each Partner Type has its own grade, outcomes and history. A Channel grade does not extend to Implementation, or vice versa.",
])
title("6. Retention, review and downgrade")
para("Performance is monitored continuously and formally reviewed at least annually. MartPoint may maintain, promote, downgrade or suspend a grade following a documented review of verified delivery, customer outcomes, service quality, compliance and current eligibility. A downgrade or suspension requires Management approval, a recorded reason and evidence, and partner notification. It does not invalidate commissions or fees already properly earned under signed terms.")
para("The 90-day activity-monitoring framework is separate from this grade review. Activity such as meetings or lead registration may inform engagement monitoring but does not substitute for completed business delivery.")
title("7. Policy updates and commercial protection")
para("MartPoint may review and update this policy as business requirements change. Material changes will ordinarily be communicated through the Partner Portal or registered email at least 30 days before taking effect, and will apply prospectively. An update does not retrospectively cancel properly earned commissions, approved fees or other accrued contractual entitlements. Changes to signed commercial terms follow the agreement amendment process.")
title("8. Policy status and acknowledgement")
para("This policy becomes effective only on the effective date recorded when Management formally approves it. Until then, it is a proposed policy and does not govern grade awards. The current approved version and prior versions will be available in Partner Portal Resources. Partners will acknowledge the applicable version and acknowledgement date will be recorded.")
para("Issued by Business & Partnership Department  |  partners@martpoint.com.ng  |  www.martpoint.com.ng")
footer()
fs.writeFileSync(out, Buffer.from(doc.output("arraybuffer")))
console.log(out)
