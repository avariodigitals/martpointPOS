import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"
import type { PartnerType } from "./partners"
import {
  AGREEMENT_TEMPLATE_VERSION,
  agreementTypeKeys,
  commonTerms,
  orBlank,
  scheduleName,
  typeScheduleClauses,
  TYPE_LABELS,
  TYPE_SCHEDULE_TITLES,
  BLANK,
  type AgreementTypeKey,
} from "./partner-agreement-content"

export {
  AGREEMENT_TEMPLATE_VERSION,
  agreementTypeKeys,
  earningBasesFor,
  defaultPermittedActivities,
  defaultInsurance,
  defaultTrigger,
  ACQUISITION_TRIGGER_TEXT,
  TYPE_LABELS,
  TYPE_SCHEDULE_TITLES,
} from "./partner-agreement-content"
export type { AgreementTypeKey } from "./partner-agreement-content"

export interface CommercialSection {
  earningCategory: string
  partnerTypeLabel: string
  eligibleItems: string
  rateOrFee: string
  eligibleRevenueDefinition: string
  exclusions: string
  attributionRule: string
  trigger: string
  holdingDays: string
  holdingStartEvent: string
  renewalRule: string
  reversalRule: string
  statementCycle: string
  payoutTiming: string
  currencyAndTaxRule: string
  splitRule: string
  financeApprover: string
  managementApprover: string
}

export interface AdditionalSchedule {
  title: string
  body: string
}

export interface AgreementInput {
  agreementId: string
  effectiveDate: string
  initialTermMonths: string
  renewalRule: string
  noticeDays: string
  disputeDays: string
  securityNoticeHours: string
  referralProtectionDays: string
  liabilityFloor: string
  partnerType: PartnerType | string
  martpoint: {
    legalName: string
    registrationNo: string
    registeredAddress: string
    noticeEmail: string
    signatoryName: string
    signatoryTitle: string
    signatoryEmail: string
  }
  partner: {
    legalName: string
    registrationNo: string
    registeredAddress: string
    email: string
    noticeEmail: string
    operationsContactName: string
    operationsContactEmail: string
    signatoryName: string
    signatoryTitle: string
    signatoryEmail: string
  }
  appointment: {
    levelByType: string
    gradeByType: string
    territory: string
    permittedActivities: string
    additionalProhibitions: string
    insurance: string
    martpointOwnerName: string
    martpointOwnerEmail: string
  }
  technology?: {
    solutionName: string
    solutionVersion: string
    approvedUseCase: string
  }
  commercials: CommercialSection[]
  additionalSchedules?: AdditionalSchedule[]
}

export interface GeneratedAgreement {
  bytes: Buffer
  fileName: string
  includedSchedules: string[]
  pageCount: number
}

export interface AgreementRenderOptions {
  /** PNG data URL for the letterhead logo (jsPDF cannot embed WebP). */
  logoDataUrl?: string
}

const BRAND_BLUE: [number, number, number] = [0, 87, 255]
const BRAND_COMPANY_LINES = ["MartPoint", "hello@martpoint.com.ng", "+234 803 602 8069", "www.martpoint.com.ng"]

const COMMERCIAL_FIELD_ROWS: { label: string; key: keyof CommercialSection }[] = [
  { label: "Applicable partner type", key: "partnerTypeLabel" },
  { label: "Earning category", key: "earningCategory" },
  { label: "Eligible product or service", key: "eligibleItems" },
  { label: "Rate or fixed fee", key: "rateOrFee" },
  { label: "Eligible revenue definition", key: "eligibleRevenueDefinition" },
  { label: "Excluded amounts", key: "exclusions" },
  { label: "Attribution requirement", key: "attributionRule" },
  { label: "Payment and activation trigger", key: "trigger" },
  { label: "Renewal eligibility", key: "renewalRule" },
  { label: "Refund and chargeback treatment", key: "reversalRule" },
  { label: "Statement cycle", key: "statementCycle" },
  { label: "Payout timing", key: "payoutTiming" },
  { label: "Currency and taxes", key: "currencyAndTaxRule" },
  { label: "Approved split or non-stacking rule", key: "splitRule" },
  { label: "Finance approver", key: "financeApprover" },
  { label: "Management approver", key: "managementApprover" },
]

export function generatePartnerAgreementPdf(input: AgreementInput, opts?: AgreementRenderOptions): GeneratedAgreement {
  const typeKeys = agreementTypeKeys(input.partnerType)
  if (typeKeys.length === 0) throw new Error(`Unsupported partner type: ${input.partnerType}`)

  const doc = new jsPDF({ unit: "pt", format: "a4" })
  const margin = 56
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const contentW = pageW - margin * 2
  const bottomLimit = pageH - 76
  let y = margin

  const ensureSpace = (needed: number) => {
    if (y + needed > bottomLimit) {
      doc.addPage()
      y = margin
    }
  }

  const para = (text: string, opts: { size?: number; gap?: number; bold?: boolean; color?: [number, number, number] } = {}) => {
    const { size = 10, gap = 8, bold = false, color = [31, 41, 55] } = opts
    doc.setFont("times", bold ? "bold" : "normal")
    doc.setFontSize(size)
    doc.setTextColor(...color)
    const lines = doc.splitTextToSize(text, contentW) as string[]
    for (const line of lines) {
      ensureSpace(size * 1.35)
      doc.text(line, margin, y)
      y += size * 1.35
    }
    y += gap
  }

  const centered = (text: string, size: number, bold = true, gap = 6) => {
    doc.setFont("times", bold ? "bold" : "normal")
    doc.setFontSize(size)
    doc.setTextColor(17, 24, 39)
    ensureSpace(size * 1.8)
    doc.text(text, pageW / 2, y, { align: "center" })
    y += size * 1.35 + gap
  }

  const clauseHeading = (text: string) => {
    ensureSpace(44)
    doc.setFont("times", "bold")
    doc.setFontSize(10.5)
    doc.setTextColor(17, 24, 39)
    doc.text(text, margin, y)
    y += 15
  }

  const scheduleHeading = (text: string) => {
    ensureSpace(70)
    y += 10
    doc.setFont("times", "bold")
    doc.setFontSize(13)
    doc.setTextColor(0, 87, 255)
    doc.text(text, margin, y)
    y += 12
    doc.setDrawColor(0, 87, 255)
    doc.setLineWidth(0.8)
    doc.line(margin, y, pageW - margin, y)
    y += 14
  }

  const fieldTable = (rows: [string, string][]) => {
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin, bottom: 76 },
      head: [["Field", "Value"]],
      body: rows,
      styles: { font: "times", fontSize: 9.5, cellPadding: 5, overflow: "linebreak", valign: "top", textColor: [31, 41, 55] },
      headStyles: { fillColor: [0, 87, 255], textColor: 255, fontStyle: "bold", font: "times" },
      alternateRowStyles: { fillColor: [248, 249, 250] },
      columnStyles: { 0: { cellWidth: 170, fontStyle: "bold" }, 1: { cellWidth: "auto" } },
    })
    y = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || y) + 14
  }

  // Schedule numbering: One = Appointment Summary, then type schedules, then Commercial
  // Terms, then any additional schedules; the Signature Page stays unnumbered.
  const commercialScheduleNo = 2 + typeKeys.length
  const commercialRef = `${scheduleName(commercialScheduleNo)} (Commercial Terms)`

  const vars = {
    effectiveDate: orBlank(input.effectiveDate),
    mpLegal: orBlank(input.martpoint.legalName),
    mpReg: orBlank(input.martpoint.registrationNo),
    mpAddr: orBlank(input.martpoint.registeredAddress),
    pLegal: orBlank(input.partner.legalName),
    pReg: orBlank(input.partner.registrationNo),
    pAddr: orBlank(input.partner.registeredAddress),
    disputeDays: input.disputeDays.trim() || "30",
    securityNoticeHours: input.securityNoticeHours.trim() || "4",
    liabilityFloor: orBlank(input.liabilityFloor),
    initialTermMonths: input.initialTermMonths.trim() || "12",
    renewalRule:
      input.renewalRule.trim() ||
      "renews automatically for successive twelve (12) month periods unless either Party gives written notice of non-renewal at least thirty (30) days before expiry",
    noticeDays: input.noticeDays.trim() || "30",
    referralProtectionDays: input.referralProtectionDays.trim() || "90",
    commercialRef,
    techSolutionName: orBlank(input.technology?.solutionName),
    techSolutionVersion: orBlank(input.technology?.solutionVersion),
    techUseCase: orBlank(input.technology?.approvedUseCase),
  }

  // Included-schedule index — also feeds the Appointment Summary "Included schedules" row.
  const includedSchedules: string[] = [`${scheduleName(1)} — Appointment Summary`]
  typeKeys.forEach((key, i) => includedSchedules.push(`${scheduleName(2 + i)} — ${TYPE_SCHEDULE_TITLES[key]}`))
  includedSchedules.push(`${scheduleName(commercialScheduleNo)} — Commercial Terms`)
  ;(input.additionalSchedules || []).forEach((s, i) =>
    includedSchedules.push(`${scheduleName(commercialScheduleNo + 1 + i)} — ${s.title}`)
  )
  includedSchedules.push("Signature Page")

  /* ── Branded letterhead: logo left, company details right (matches quotation PDFs) ── */
  let logoH = 0
  if (opts?.logoDataUrl) {
    try {
      const props = doc.getImageProperties(opts.logoDataUrl)
      const scale = Math.min(140 / props.width, 44 / props.height, 1)
      const w = Math.max(1, Math.round(props.width * scale))
      const h = Math.max(1, Math.round(props.height * scale))
      doc.addImage(opts.logoDataUrl, "PNG", margin, y, w, h)
      logoH = h
    } catch {
      doc.setFont("helvetica", "bold")
      doc.setFontSize(18)
      doc.setTextColor(...BRAND_BLUE)
      doc.text("MartPoint", margin, y + 20)
      logoH = 30
    }
  } else {
    doc.setFont("helvetica", "bold")
    doc.setFontSize(18)
    doc.setTextColor(...BRAND_BLUE)
    doc.text("MartPoint", margin, y + 20)
    logoH = 30
  }

  doc.setFont("helvetica", "normal")
  doc.setFontSize(9)
  doc.setTextColor(107, 114, 128)
  BRAND_COMPANY_LINES.forEach((line, i) => {
    doc.text(line, pageW - margin, y + 9 + i * 13, { align: "right" })
  })
  y += Math.max(logoH, BRAND_COMPANY_LINES.length * 13) + 12

  doc.setDrawColor(...BRAND_BLUE)
  doc.setLineWidth(1.2)
  doc.line(margin, y, pageW - margin, y)
  y += 22

  /* ── Title + parties ── */
  centered("PARTNER AGREEMENT", 18, true, 4)
  centered(`Agreement ${input.agreementId}`, 10, false, 14)

  para(`This Partner Agreement is made on ${vars.effectiveDate} between:`)
  para(`(1) ${vars.mpLegal}, registration number ${vars.mpReg}, of ${vars.mpAddr} (MartPoint); and`, { gap: 4 })
  para(`(2) ${vars.pLegal}, registration number ${vars.pReg}, of ${vars.pAddr} (Partner).`)
  para("Each is a Party and together they are the Parties.", { gap: 12 })

  clauseHeading("Background")
  para("MartPoint provides retail business software, licensing, implementation coordination and related services.", { gap: 4 })
  para("The Partner has applied and been approved to perform the activities stated in the Appointment Summary.", { gap: 4 })
  para("The Parties wish to record the terms of the appointment, including responsibilities, commercial conditions, customer protection, data handling and exit obligations.", { gap: 12 })

  /* ── Common terms ── */
  for (const part of commonTerms(vars)) {
    if (part.part) {
      ensureSpace(50)
      y += 4
      doc.setFont("times", "bold")
      doc.setFontSize(12)
      doc.setTextColor(17, 24, 39)
      doc.text(part.part, margin, y)
      y += 18
    }
    for (const clause of part.clauses) {
      clauseHeading(`${clause.num} ${clause.title}`)
      para(clause.body, { gap: 10 })
    }
  }

  /* ── Schedule One: Appointment Summary ── */
  scheduleHeading(`${scheduleName(1)} — Appointment Summary`)
  const typesLabel = typeKeys.map((k) => TYPE_LABELS[k]).join("; ")
  const levelByType = typeKeys.map((k) => `${TYPE_LABELS[k]}: ${orBlank(input.appointment.levelByType)}`).join("; ")
  const gradeByType = typeKeys.map((k) => `${TYPE_LABELS[k]}: ${orBlank(input.appointment.gradeByType)}`).join("; ")
  fieldTable([
    ["Agreement ID", input.agreementId],
    ["Effective date", vars.effectiveDate],
    ["Initial term", `${vars.initialTermMonths} months`],
    ["MartPoint entity", `${vars.mpLegal} / ${vars.mpReg}`],
    ["Partner", `${vars.pLegal} / ${vars.pReg}`],
    ["Approved partner type or types", typesLabel],
    ["Operating level by type", levelByType],
    ["Starting grade by type", gradeByType],
    ["Territory or service area", orBlank(input.appointment.territory)],
    ["Permitted activities", orBlank(input.appointment.permittedActivities)],
    ["Express prohibitions", orBlank(input.appointment.additionalProhibitions)],
    ["Required insurance", orBlank(input.appointment.insurance)],
    ["MartPoint owner", `${orBlank(input.appointment.martpointOwnerName)} / ${orBlank(input.appointment.martpointOwnerEmail)}`],
    ["Partner operational contact", `${orBlank(input.partner.operationsContactName)} / ${orBlank(input.partner.operationsContactEmail)}`],
    ["Formal notice emails", `MartPoint: ${orBlank(input.martpoint.noticeEmail)} | Partner: ${orBlank(input.partner.noticeEmail)}`],
    ["Included schedules", includedSchedules.join("; ")],
    ["Activation condition", "Signing does not itself activate every permission. MartPoint must issue an Activation Confirmation, and any customer, implementation, integration or production activity must also have the required assignment or approval."],
  ])

  /* ── Partner type schedules (only those matching the approved types) ── */
  typeKeys.forEach((key: AgreementTypeKey, i: number) => {
    scheduleHeading(`${scheduleName(2 + i)} — ${TYPE_SCHEDULE_TITLES[key]}`)
    for (const clause of typeScheduleClauses(key, vars)) {
      clauseHeading(`${clause.id} ${clause.title}`)
      para(clause.body, { gap: 8 })
    }
  })

  /* ── Commercial Terms — one section per approved earning basis ── */
  scheduleHeading(`${scheduleName(commercialScheduleNo)} — Commercial Terms`)
  input.commercials.forEach((c, i) => {
    if (input.commercials.length > 1) {
      clauseHeading(`${String.fromCharCode(65 + i)}. ${orBlank(c.earningCategory)}`)
    }
    const holding = c.holdingDays.trim()
      ? `${c.holdingDays.trim()} days from ${orBlank(c.holdingStartEvent)}`
      : BLANK
    fieldTable([
      ["Schedule ID and version", `${input.agreementId}-C${i + 1} / v${AGREEMENT_TEMPLATE_VERSION}`],
      ...COMMERCIAL_FIELD_ROWS.slice(0, 8).map((r): [string, string] => [r.label, orBlank(c[r.key] as string)]),
      ["Holding period", holding],
      ...COMMERCIAL_FIELD_ROWS.slice(8).map((r): [string, string] => [r.label, orBlank(c[r.key] as string)]),
    ])
  })

  /* ── Additional conditional schedules (only when supplied — never empty) ── */
  ;(input.additionalSchedules || []).forEach((s, i) => {
    scheduleHeading(`${scheduleName(commercialScheduleNo + 1 + i)} — ${s.title}`)
    for (const p of s.body.split(/\n{2,}/).map((t) => t.trim()).filter(Boolean)) {
      para(p, { gap: 8 })
    }
  })

  /* ── Signature Page (always last, own page) ── */
  doc.addPage()
  y = margin
  scheduleHeading("Signature Page")
  para("The Parties agree to the Agreement, Appointment Summary and included Schedules identified above.", { gap: 12 })

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin, bottom: 76 },
    head: [[`For ${vars.mpLegal}`, `For ${vars.pLegal}`]],
    body: [
      [`Name: ${orBlank(input.martpoint.signatoryName)}`, `Name: ${orBlank(input.partner.signatoryName)}`],
      [`Title: ${orBlank(input.martpoint.signatoryTitle)}`, `Title: ${orBlank(input.partner.signatoryTitle)}`],
      ["Signature: ______________________________", "Signature: ______________________________"],
      ["Date: ______________________________", "Date: ______________________________"],
      [`Email: ${orBlank(input.martpoint.signatoryEmail)}`, `Email: ${orBlank(input.partner.signatoryEmail)}`],
    ],
    styles: { font: "times", fontSize: 10, cellPadding: 8, overflow: "linebreak", valign: "top", textColor: [31, 41, 55] },
    headStyles: { fillColor: [0, 87, 255], textColor: 255, fontStyle: "bold", font: "times" },
    columnStyles: { 0: { cellWidth: contentW / 2 }, 1: { cellWidth: contentW / 2 } },
  })
  y = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || y) + 20

  clauseHeading("Electronic signature record")
  fieldTable([
    ["Agreement ID", input.agreementId],
    ["Final document hash", BLANK],
    ["MartPoint signature event", BLANK],
    ["Partner signature event", BLANK],
    ["Completion certificate", BLANK],
  ])

  /* ── Footer on every page ── */
  const totalPages = (doc as unknown as { getNumberOfPages: () => number }).getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    ;(doc as unknown as { setPage: (n: number) => void }).setPage(i)
    const footerY = pageH - 34
    doc.setDrawColor(229, 231, 235)
    doc.setLineWidth(0.5)
    doc.line(margin, footerY - 8, pageW - margin, footerY - 8)
    doc.setFont("times", "normal")
    doc.setFontSize(8.5)
    doc.setTextColor(107, 114, 128)
    doc.text(`${input.agreementId} — ${orBlank(input.partner.legalName)}`, margin, footerY)
    doc.text(`Page ${i} of ${totalPages}`, pageW - margin, footerY, { align: "right" })
  }

  const safeRef = input.agreementId.replace(/[^a-zA-Z0-9-]/g, "_")
  return {
    bytes: Buffer.from(doc.output("arraybuffer")),
    fileName: `MartPoint-Partner-Agreement-${safeRef}.pdf`,
    includedSchedules,
    pageCount: totalPages,
  }
}
