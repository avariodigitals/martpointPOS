import { agreementTypeKeys, earningBasesFor } from "./partner-agreement-content"
import type { AgreementInput, CommercialSection } from "./partner-agreement"

const REQUIRED_PARTY_FIELDS: [string, string][] = [
  ["MartPoint legal name", "martpoint.legalName"],
  ["MartPoint registration number", "martpoint.registrationNo"],
  ["MartPoint registered address", "martpoint.registeredAddress"],
  ["MartPoint notice email", "martpoint.noticeEmail"],
  ["MartPoint authorised signatory name", "martpoint.signatoryName"],
  ["MartPoint authorised signatory title", "martpoint.signatoryTitle"],
  ["MartPoint authorised signatory email", "martpoint.signatoryEmail"],
  ["Partner legal name", "partner.legalName"],
  ["Partner registration number", "partner.registrationNo"],
  ["Partner registered address", "partner.registeredAddress"],
  ["Partner notice email", "partner.noticeEmail"],
  ["Partner signatory name", "partner.signatoryName"],
  ["Partner signatory title", "partner.signatoryTitle"],
  ["Partner signatory email", "partner.signatoryEmail"],
]

const REQUIRED_COMMERCIAL_FIELDS: (keyof CommercialSection)[] = [
  "eligibleItems", "rateOrFee", "rateUnit", "eligibleRevenueDefinition", "exclusions",
  "attributionRule", "trigger", "holdingDays", "renewalRule", "renewalRate", "renewalDuration",
  "reversalRule", "statementCycle", "payoutTiming", "minimumPayoutThreshold",
  "currencyAndTaxRule", "splitRule", "financeApprover", "managementApprover",
]

export function validateAgreementInput(input: AgreementInput): string[] {
  const errors: string[] = []
  const add = (message: string) => errors.push(message)
  const check = (label: string, value: unknown) => {
    if (typeof value !== "string" || !value.trim()) {
      add(`${label} is required.`)
      return
    }
    if (/\b(to be completed|to be confirmed|pending|tbd|placeholder|enter approved|must be completed|select .*user)\b/i.test(value)) {
      add(`${label} still contains placeholder or unapproved wording.`)
    }
  }

  if (!input.agreementId?.trim()) add("Agreement ID is required.")
  if (!input.effectiveDate || !/^\d{4}-\d{2}-\d{2}$/.test(input.effectiveDate)) add("A valid effective date is required.")
  if (!/^\d+$/.test(input.initialTermMonths || "") || Number(input.initialTermMonths) < 1) add("The initial term must be a positive number of months.")
  check("Agreement renewal or expiry rule", input.renewalRule)
  for (const [label, key] of REQUIRED_PARTY_FIELDS) {
    const value = key.split(".").reduce<unknown>((obj, segment) => (obj as Record<string, unknown> | undefined)?.[segment], input)
    check(label, value)
  }

  const typeKeys = agreementTypeKeys(input.partnerType)
  if (!typeKeys.length) add("At least one supported Partner Type is required.")
  check("Operating level by Partner Type", input.appointment.levelByType)
  check("Starting grade or explicit not-applicable status by Partner Type", input.appointment.gradeByType)
  check("Public Directory status", input.appointment.publicDirectoryStatus)
  if (!input.appointment.gradeByType?.trim().toLowerCase().startsWith("ungraded")) {
    errors.push("New Partner appointments must start Ungraded; Standard operating level is not a grade")
  }
  if (!input.appointment.publicDirectoryStatus?.trim().toLowerCase().startsWith("not yet eligible")) {
    errors.push("New Partner appointments must start as not yet eligible for the Public Directory")
  }
  check("Territory or service area", input.appointment.territory)
  check("MartPoint owner name", input.appointment.martpointOwnerName)
  check("MartPoint owner email", input.appointment.martpointOwnerEmail)
  check("Insurance requirement or explicit not-required statement", input.appointment.insurance)
  check("Permitted activities", input.appointment.permittedActivities)
  check("Express prohibitions", input.appointment.additionalProhibitions)
  check("Termination notice period", input.noticeDays)
  check("Statement dispute period", input.disputeDays)
  check("Security incident notice period", input.securityNoticeHours)
  check("Liability cap or explicit cap treatment", input.liabilityFloor)

  if (!input.commercials?.length) add("At least one complete Commercial Terms section is required.")
  const requiredCommercialTypes = earningBasesFor(input.partnerType).map((basis) => basis.partnerTypeLabel)
  for (const requiredType of requiredCommercialTypes) {
    if (!(input.commercials || []).some((section) => section.partnerTypeLabel === requiredType)) {
      add(`A Commercial Terms section for ${requiredType} is required.`)
    }
  }
  input.commercials?.forEach((section, index) => {
    const prefix = `Commercial section ${index + 1}`
    check(`${prefix} earning category`, section.earningCategory)
    check(`${prefix} Partner Type`, section.partnerTypeLabel)
    for (const key of REQUIRED_COMMERCIAL_FIELDS) check(`${prefix} ${String(key)}`, section[key])
    if (section.rateUnit && !["PERCENTAGE", "FIXED", "WORK_ORDER", "OTHER"].includes(String(section.rateUnit).toUpperCase())) {
      add(`${prefix} must use a supported rate unit.`)
    }
    const rateOrFee = typeof section.rateOrFee === "string" ? section.rateOrFee : ""
    if (section.rateUnit === "PERCENTAGE" && !/%|percent|percentage/i.test(rateOrFee) && !/^\d+(?:\.\d+)?$/.test(rateOrFee.trim())) {
      add(`${prefix} percentage must be a valid numeric percentage of Eligible Revenue.`)
    }
    const renewal = String(section.renewalRule || "").toLowerCase()
    const renewalApproved = /approved|eligible|commission applies|renewal commission applies/.test(renewal) && !/no automatic|not approved|none/.test(renewal)
    if (renewalApproved && (!section.renewalRate?.trim() || !section.renewalDuration?.trim())) {
      add(`${prefix} approved renewal terms must specify both a renewal rate and duration.`)
    }
    if (String(section.earningCategory || "").toLowerCase().includes("commission") && !section.minimumPayoutThreshold?.trim()) {
      add(`${prefix} must state a minimum payout threshold or expressly say there is no minimum.`)
    }
  })

  if (input.partnerType === "TECHNOLOGY") {
    check("Approved technology solution name", input.technology?.solutionName)
    check("Approved technology solution version or explicit not-applicable status", input.technology?.solutionVersion)
    check("Approved technology use case", input.technology?.approvedUseCase)
  }
  for (const [index, schedule] of (input.additionalSchedules || []).entries()) {
    check(`Additional Schedule ${index + 1} title`, schedule.title)
    check(`Additional Schedule ${index + 1} body`, schedule.body)
  }
  return errors
}
