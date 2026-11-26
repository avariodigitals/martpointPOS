import { jsPDF } from "jspdf"

const BLUE = [31, 86, 255]
const INK = [25, 34, 52]
const MUTED = [94, 105, 126]
const LEFT = 16
const RIGHT = 16

function safeDate(value, dateOnly = false) {
  if (!value) return "Not recorded"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Not recorded"
  return new Intl.DateTimeFormat("en-GB", dateOnly
    ? { day: "2-digit", month: "long", year: "numeric", timeZone: "Africa/Lagos" }
    : { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Lagos" }
  ).format(date)
}

/** Build the policy PDF from the approved database record, so thresholds and approval metadata cannot drift. */
export function renderPartnerGradingPolicyPdf(policy = {}) {
  const approved = String(policy.status || "DRAFT").toUpperCase() === "APPROVED"
  const version = String(policy.version || "1.0")
  const effectiveDate = safeDate(policy.effective_at, true)
  const approvalTimestamp = safeDate(policy.approved_at || policy.effective_at)
  const silver = Number(policy.silver_outcomes ?? 1)
  const gold = Number(policy.gold_outcomes ?? 10)
  const platinum = Number(policy.platinum_outcomes ?? 25)
  const silverDays = Number(policy.silver_min_days ?? 90)
  const goldDays = Number(policy.gold_min_days ?? 183)
  const platinumDays = Number(policy.platinum_min_days ?? 365)
  const officer = String(policy.approved_by_name || "")
  let policyCriteria = policy.criteria || {}
  if (typeof policyCriteria === "string") {
    try { policyCriteria = JSON.parse(policyCriteria) } catch { policyCriteria = {} }
  }
  const policyTypes = Array.isArray(policyCriteria.partnerTypes) ? policyCriteria.partnerTypes.map((type) => String(type).toUpperCase()) : ["CHANNEL", "IMPLEMENTATION"]
  const trackDefinitions = {
    REFERRAL: ["Referral Partner", "One distinct referred customer with eligible payment cleared and the MartPoint licence activated; verified against the originating partner attribution."],
    CHANNEL: ["Channel Partner", "One distinct customer acquired through an accepted opportunity, with eligible subscription payment cleared and the MartPoint licence activated."],
    IMPLEMENTATION: ["Implementation Partner", "One distinct authorised customer implementation completed and formally accepted by MartPoint under a Work Order."],
    TECHNOLOGY: ["Technology Partner", "One distinct customer production integration completed and formally accepted by MartPoint after technical compatibility and applicable security review."],
    PAYMENT: ["Payment Partner", "One distinct approved merchant/payment-service deployment live in production with at least one successfully settled and reconciled transaction, subject to applicable compliance approval."],
  }
  const scopedTrackDefinitions = Object.entries(trackDefinitions).filter(([type]) => policyTypes.includes(type)).map(([, definition]) => definition)
  const scopedTrackNames = scopedTrackDefinitions.map(([label]) => label.replace(/ Partner$/, ""))

  const doc = new jsPDF({ unit: "mm", format: "a4" })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const contentWidth = pageWidth - LEFT - RIGHT
  let page = 1
  let y = 0

  function footer() {
    doc.setDrawColor(225, 230, 239)
    doc.line(LEFT, pageHeight - 13, pageWidth - RIGHT, pageHeight - 13)
    doc.setFont("helvetica", "normal")
    doc.setFontSize(7.5)
    doc.setTextColor(...MUTED)
    const status = approved ? `APPROVED · Effective ${effectiveDate}` : "PROPOSED · Not effective until Management approval"
    doc.text(`MP-POL-PGP-001  |  Version ${version}  |  ${status}`, LEFT, pageHeight - 7)
    doc.text(String(page), pageWidth - RIGHT, pageHeight - 7, { align: "right" })
  }

  function startPage(second = false) {
    if (second) {
      footer()
      doc.addPage()
      page += 1
      y = 18
      return
    }
    doc.setFillColor(247, 249, 255)
    doc.rect(0, 0, pageWidth, 32, "F")
    doc.setFont("helvetica", "bold")
    doc.setFontSize(9)
    doc.setTextColor(...BLUE)
    doc.text("MARTPOINT", LEFT, 10)
    doc.setFontSize(18)
    doc.setTextColor(...INK)
    doc.text("Partner Performance, Grading & Progression Policy", LEFT, 20)
    doc.setFont("helvetica", "normal")
    doc.setFontSize(7.8)
    doc.setTextColor(...MUTED)
    doc.text(`MP-POL-PGP-001  |  Version ${version}  |  ${approved ? "Approved policy" : "Partner resource"}`, LEFT, 27)
    doc.setFont("helvetica", "bold")
    doc.setFontSize(7.6)
    doc.setTextColor(...(approved ? [22, 113, 67] : [154, 48, 21]))
    doc.text(approved ? `APPROVED · EFFECTIVE ${effectiveDate.toUpperCase()}` : "PROPOSED · EFFECTIVE ONLY UPON MANAGEMENT APPROVAL", pageWidth - RIGHT, 27, { align: "right" })
    y = 38
  }

  function section(text) {
    doc.setFont("helvetica", "bold")
    doc.setFontSize(10.5)
    doc.setTextColor(...BLUE)
    doc.text(text, LEFT, y)
    y += 6
  }

  function para(text, size = 8.8) {
    doc.setFont("helvetica", "normal")
    doc.setFontSize(size)
    doc.setTextColor(...INK)
    const lines = doc.splitTextToSize(text, contentWidth)
    doc.text(lines, LEFT, y)
    y += lines.length * 3.9 + 2.5
  }

  function bullet(text) {
    doc.setFont("helvetica", "normal")
    doc.setFontSize(8.4)
    doc.setTextColor(...INK)
    const lines = doc.splitTextToSize(text, contentWidth - 6)
    doc.setFillColor(...BLUE)
    doc.circle(LEFT + 1.1, y - 0.8, 0.55, "F")
    doc.text(lines, LEFT + 4, y)
    y += lines.length * 3.65 + 1.5
  }

  function table(headers, rows, widths, fontSize = 8) {
    const rowHeight = 7
    doc.setFillColor(...BLUE)
    doc.rect(LEFT, y - 4.5, contentWidth, rowHeight, "F")
    doc.setFont("helvetica", "bold")
    doc.setFontSize(fontSize)
    doc.setTextColor(255, 255, 255)
    let x = LEFT
    headers.forEach((cell, index) => { doc.text(cell, x + 2, y); x += widths[index] })
    y += rowHeight - 1
    rows.forEach((row, rowIndex) => {
      const cells = row.map((cell, index) => doc.splitTextToSize(String(cell), widths[index] - 4))
      const lines = Math.max(...cells.map((cell) => cell.length))
      const height = Math.max(rowHeight, lines * 3.5 + 2.8)
      if (rowIndex % 2 === 0) {
        doc.setFillColor(244, 247, 251)
        doc.rect(LEFT, y - 4.5, contentWidth, height, "F")
      }
      doc.setFont("helvetica", "normal")
      doc.setFontSize(fontSize)
      doc.setTextColor(...INK)
      x = LEFT
      cells.forEach((cell, index) => { doc.text(cell, x + 2, y); x += widths[index] })
      y += height
    })
    y += 2
  }

  startPage()
  section("1. Purpose, separate tracks and starting status")
  para(`This policy defines separate performance tracks for ${scopedTrackNames.join(", ")} Partner appointments. A Channel + Implementation Partner has two independent tracks; outcomes and grades do not transfer between tracks. Each new Partner starts Ungraded. Application approval, agreement signing, training, certification or onboarding alone does not award a grade.`)
  para("The initial 90-day activation and activity-monitoring period is an operational check, not a grade or qualifying outcome. It may run alongside the minimum grade duration. Contractual commissions and approved implementation fees remain governed by their signed terms.")

  section("2. Grade thresholds")
  table(["Grade", "Qualifying outcomes", "Minimum duration", "Review window"], [
    [`Silver`, `${silver} in the relevant Partner Type`, `${silverDays} days`, "At least one verified outcome"],
    [`Gold`, `${gold} in the relevant Partner Type`, `${goldDays} days`, "Rolling 12 months"],
    [`Platinum`, `${platinum} in the relevant Partner Type`, `${platinumDays} days`, "Rolling 12 months"],
  ], [27, 58, 34, contentWidth - 119])
  para("Thresholds create eligibility for assessment, not automatic entitlement. Completed onboarding, applicable certification, satisfactory customer outcomes and compliance, a documented performance review, and written Management approval are also required.", 8.5)

  section("3. Qualifying outcomes")
  para("Only distinct, completed and Management-verified outcomes in an enabled Partner Type track count. Repeated invoices, milestones, renewals, branches, seats or change orders for the same underlying outcome do not create additional outcomes.", 8.4)
  table(["Partner Type track", "Qualifying outcome"], scopedTrackDefinitions, [38, contentWidth - 38], 7.2)
  bullet("Fraudulent, refunded, charged-back, reversed, cancelled or otherwise clawed-back customer acquisitions and transactions do not qualify. If later invalidated, MartPoint removes the outcome and reassesses eligibility.")
  bullet("For Technology and Payment tracks, an unapproved, test-only, incomplete or non-production integration does not qualify. Payment outcomes also require applicable compliance approval and cleared, reconciled settlement.")
  bullet("Leads, meetings, demonstrations, quotations, proposals, training, onboarding, independent service sales and free trials do not qualify by themselves.")
  para("Technology and Payment evidence is manually reviewed and approved by MartPoint; partner-submitted evidence alone is not a verified outcome.", 8.3)

  startPage(true)
  section("4. Recognition and benefits")
  table(["Ungraded", "Silver", "Gold", "Platinum"], [[
    "Portal, approved resources, onboarding and contractual earnings.",
    "Badge and certificate; eligible for directory review after separate approval.",
    "Silver benefits; priority consideration for suitable opportunities and joint marketing.",
    "Gold benefits; priority consideration for strategic opportunities, commercial reviews and roadmap engagement.",
  ]], [contentWidth / 4, contentWidth / 4, contentWidth / 4, contentWidth / 4], 7.8)
  para("Priority is consideration only. It does not guarantee leads, assignments, revenue, exclusivity or minimum work. Grades do not automatically change fees or commissions.", 8.4)

  section("5. Assessment, badges and directory")
  bullet("MartPoint verifies type-specific evidence: cleared payment and licence activation for Referral and Channel; formally accepted Work Orders for Implementation; accepted production integrations for Technology; and reconciled settlements for Payment. Partners cannot self-certify outcomes.")
  bullet("Management reviews evidence, duration, onboarding, certification, customer outcomes and compliance before making a written decision.")
  bullet("A badge or public listing requires formal grade award for that Partner Type and separate directory eligibility and publication approval.")

  section("6. Annual review, retention and downgrade")
  para(`Management reviews each grade at least annually. To retain Silver, Gold or Platinum, the Partner must meet the applicable outcome threshold (${silver}, ${gold} or ${platinum}) in the preceding 12 months, remain active and compliant, maintain required certification, and deliver satisfactory customer outcomes. Management may maintain a grade for a documented reason, set a review period, or downgrade to the highest grade whose criteria are met. Downgrade or suspension requires evidence, written notice and Management approval; it does not cancel properly earned commissions or fees. This version awards Silver, Gold and Platinum only. Previously recorded legacy grades, including any Referral Diamond grade, are not converted or reduced automatically; any change requires an authorised individual review. The 90-day activity-monitoring period remains separate from annual grade review.`, 7.8)

  section("7. Amendments and commercial protection")
  para("MartPoint may update this policy prospectively. Material changes will ordinarily be communicated through the Portal or registered email at least 30 days before taking effect. Changes do not retrospectively cancel accrued financial entitlements or amend signed commercial terms; signed terms change only through the Agreement amendment process.", 7.8)

  section("8. Approval, effective date and acknowledgement")
  if (approved) {
    table(["Approval record", "Recorded value"], [
      ["Document version", version],
      ["Approved by", officer || "Officer name unavailable"],
      ["Approval timestamp (Africa/Lagos)", approvalTimestamp],
      ["Effective date", effectiveDate],
  ], [49, contentWidth - 49], 8)
    para("This approved version governs grade assessment from its effective date. Partners must acknowledge the applicable version in the Partner Portal; the acknowledgement date is recorded against this version.", 8.4)
    if (policy.approval_reason) para(`Approval record: ${String(policy.approval_reason)}`, 8)
  } else {
    para("This is a proposed policy and does not govern grade awards until Management approves it. On approval, the approver, approval timestamp, document version and effective date will be recorded. Partners must acknowledge the applicable approved version in the Portal.", 8.5)
  }
  para("Issued by Business & Partnership Department  |  partners@martpoint.com.ng  |  www.martpoint.com.ng", 8)
  footer()
  return new Uint8Array(doc.output("arraybuffer"))
}
