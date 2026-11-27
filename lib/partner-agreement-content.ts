import type { PartnerType } from "./partners"

/* ───────────────────  Partner Agreement content (master template v1.4)  ───────────────────
 * Partner-facing wording ONLY. The master .docx is an internal "LEGAL AND AUTOMATION
 * MASTER" that also carries generation rules, internal approval logic, merge-field
 * documentation and a legal review checklist — none of which belongs in a partner's
 * signing copy. Conditional markers ([[INCLUDE IF …]]) are resolved here by selecting
 * schedules per approved partner type; unused schedules are omitted entirely.
 */

export const AGREEMENT_TEMPLATE_VERSION = "1.5"

export const CHANNEL_ACQUISITION_COMMISSION_RATE = "10%"
export const CHANNEL_RENEWAL_COMMISSION_RATE = "5%"
export const CHANNEL_RENEWAL_COMMISSION_DURATION = "Maximum two subsequent annual subscription renewals"
export const CHANNEL_COMMISSION_ELIGIBLE_ITEMS =
  "Initial qualifying MartPoint software licence subscription and up to two subsequent annual subscription renewals"
export const CHANNEL_RENEWAL_COMMISSION_RULE =
  "5% of Eligible Revenue for a maximum of two subsequent annual subscription renewals, provided the Partner maintains an active MartPoint agreement, remains officially assigned to the Customer, fulfils applicable customer support and renewal responsibilities, and remains compliant with MartPoint partnership policies. Renewal commission is not perpetual. Any extension beyond these two renewals requires MartPoint's express written approval. All commissions remain subject to applicable payment, attribution and commercial conditions."

export const CHANNEL_COMMISSION_CLAUSE =
  "The Channel Partner shall be eligible for an acquisition commission of 10% of Eligible Revenue from the initial qualifying software licence subscription. For a maximum of two subsequent annual subscription renewals, the Channel Partner shall be eligible for 5% of Eligible Revenue, provided it maintains an active MartPoint agreement, remains officially assigned to the Customer, fulfils applicable customer support and renewal responsibilities, and remains compliant with MartPoint partnership policies. Renewal commission is not a perpetual entitlement. Any extension beyond the approved two-renewal period requires MartPoint's express written approval. All commissions remain subject to applicable payment, attribution and commercial conditions."

export type AgreementTypeKey = "referral" | "channel" | "implementation" | "technology" | "payment_provider"

export function agreementTypeKeys(partnerType: PartnerType | string): AgreementTypeKey[] {
  switch (partnerType) {
    case "REFERRAL":
      return ["referral"]
    case "CHANNEL":
      return ["channel"]
    case "IMPLEMENTATION":
      return ["implementation"]
    case "CHANNEL_IMPLEMENTATION":
      return ["channel", "implementation"]
    case "TECHNOLOGY":
      return ["technology"]
    case "PAYMENT":
      return ["payment_provider"]
    default:
      return []
  }
}

export const TYPE_SCHEDULE_TITLES: Record<AgreementTypeKey, string> = {
  referral: "Referral Partner Terms",
  channel: "Channel Sales and Support Terms",
  implementation: "Implementation Partner Terms",
  technology: "Technology Partner Terms",
  payment_provider: "Payment Provider Terms",
}

export const TYPE_LABELS: Record<AgreementTypeKey, string> = {
  referral: "Referral Partner",
  channel: "Channel Partner",
  implementation: "Implementation Partner",
  technology: "Technology Partner",
  payment_provider: "Payment Provider",
}

/** Default earning bases — one Commercial Terms section is rendered per basis. */
export function earningBasesFor(partnerType: PartnerType | string): { earningCategory: string; partnerTypeLabel: string }[] {
  return agreementTypeKeys(partnerType).map((key) => ({
    partnerTypeLabel: TYPE_LABELS[key],
    earningCategory:
      key === "referral" ? "Referral commission"
      : key === "channel" ? "Channel commission"
      : key === "implementation" ? "Implementation fee"
      : key === "technology" ? "Technology commercial terms"
      : "Payment provider fees / revenue share",
  }))
}

export function defaultPermittedActivities(partnerType: PartnerType | string): string {
  const parts = agreementTypeKeys(partnerType).map((key) => {
    switch (key) {
      case "referral":
        return "Identify and introduce genuinely new prospective Customers using approved methods and register opportunities."
      case "channel":
        return "Promote and demonstrate MartPoint, register opportunities, coordinate approved sales activity and provide agreed first-line guidance to Customers assigned in writing."
      case "implementation":
        return "Perform certified implementation, configuration, data preparation, training, testing and handover under an active Work Order."
      case "technology":
        return "Develop, maintain and support the approved solution stated in the Technology Partner Schedule."
      case "payment_provider":
        return "Provide the approved payment, settlement, refund and chargeback services stated in the Payment Provider Schedule."
    }
  })
  return parts.join(" ")
}

export function defaultInsurance(partnerType: PartnerType | string): string {
  void partnerType
  return "Not required for standard partnership appointment. Each Party remains responsible for insurance required by law or appropriate to its own operations. Project-specific requirements apply only where expressly agreed in the applicable Work Order before acceptance."
}

/** Express prohibitions for the Appointment Summary — distilled from Common Terms clause 7
 * (No authority and prohibited conduct). These always apply; admin can add partner-specific ones. */
export function defaultProhibitions(partnerType: PartnerType | string): string {
  const base = [
    "No authority to bind MartPoint or sign on its behalf",
    "No altering prices, plans, quotas or entitlements, and no approving discounts",
    "No creating or activating licences, deploying MartPoint, or marking a customer live",
    "No collecting MartPoint licence payments outside an authorised payment route",
    "No unapproved warranties or representations about MartPoint",
    "No accessing customers not assigned in writing",
    "No sharing credentials, reverse engineering or copying the platform",
    "No using another partner's or customer's information",
    "No subcontracting regulated, data-sensitive or customer-facing work without written approval",
  ]
  const keys = agreementTypeKeys(partnerType)
  if (keys.includes("payment_provider")) {
    base.push("No holding, delaying or rerouting settlement funds outside the agreed settlement terms")
  }
  if (keys.includes("technology")) {
    base.push("No production deployment or customer-facing release without a signed Production Approval")
  }
  return base.map((p) => `• ${p}`).join("\n")
}

/** Per-field template defaults for a Commercial Terms section, keyed by earning basis.
 * Keeps generated wording consistent with the master template's commercial schedule. */
export function commercialFieldDefaults(earningCategory: string, partnerTypeLabel = ""): Partial<Record<string, string>> {
  const cat = earningCategory.toLowerCase()
  const acquisition = cat.includes("commission")
  const implementationFee = cat.includes("implementation")
  const channelCommission = partnerTypeLabel.toLowerCase() === "channel partner" && cat.includes("commission")
  return {
    ...(channelCommission ? { rateOrFee: CHANNEL_ACQUISITION_COMMISSION_RATE } : implementationFee ? { rateOrFee: "Agreed per approved Work Order" } : {}),
    rateUnit: acquisition ? "PERCENTAGE" : cat.includes("implementation") ? "WORK_ORDER" : "FIXED",
    eligibleRevenueDefinition: implementationFee
      ? "Not applicable to implementation fees. Use fixed or milestone-based fees expressly agreed in an approved Work Order or signed Fee Schedule."
      : "Eligible Revenue as defined in clause 2 — net software revenue actually received and cleared by MartPoint after approved discounts, excluding taxes, refunds, chargebacks, hardware, third-party charges and excluded services.",
    exclusions: implementationFee
      ? "Channel commission exclusions apply only to the software commission basis and do not invalidate separately approved implementation fees. Implementation fees are limited to the scope and milestones expressly stated in an approved Work Order or signed Fee Schedule."
      : "Taxes, refunds, chargebacks, hardware, third-party charges and any excluded services.",
    attributionRule: acquisition
      ? "Opportunity must be registered by the Partner and accepted by MartPoint before the sale, and attribution must still be active at payment."
      : implementationFee
      ? "Fees apply only to implementation services assigned to the Partner under an approved, signed Work Order or Fee Schedule; customer acquisition attribution and licence activation are not required unless the Work Order expressly states an applicable milestone."
      : "Earning applies only to work or services expressly assigned to the Partner in writing (Work Order, Customer Assignment or Production Approval).",
    holdingDays: acquisition ? "30" : "0",
    holdingStartEvent: acquisition
      ? "Acquisition: later of cleared Customer payment or required licence activation; renewal: later of cleared renewal payment or effective subscription renewal"
      : implementationFee
      ? "No additional holding period; approved Work Order acceptance and applicable cleared Customer payment conditions apply"
      : "Customer payment cleared",
    renewalRule: channelCommission ? CHANNEL_RENEWAL_COMMISSION_RULE : acquisition
      ? "No automatic renewal commission entitlement. Any renewal commission requires express approval in a signed Commercial Schedule stating its rate, eligible renewal term and duration."
      : "Fees apply per engagement; renewals require a new or extended assignment.",
    renewalRate: channelCommission ? CHANNEL_RENEWAL_COMMISSION_RATE : acquisition ? "Not approved; no automatic renewal commission" : "Not applicable",
    renewalDuration: channelCommission ? CHANNEL_RENEWAL_COMMISSION_DURATION : acquisition ? "None unless expressly approved in a signed Commercial Schedule" : "Not applicable",
    reversalRule:
      "Earnings on refunded, charged-back, fraudulent or reversed amounts are deducted or clawed back; MartPoint may offset against future payouts.",
    statementCycle: "Monthly",
    payoutTiming: acquisition
      ? "Statements are issued monthly. Eligible acquisition commissions are paid within 15 days after the applicable monthly statement is issued, subject to the 30-day holding period from the later of cleared Customer payment or required licence activation. Renewal commissions are subject to a 30-day holding period from the later of cleared renewal payment or effective subscription renewal. Payment also requires confirmed Partner attribution, an active agreement and compliance with applicable Partner terms. Any statutory deductions required by law apply."
      : implementationFee
      ? "Implementation fees are payable within 15 days after the applicable monthly statement is issued, subject to formal acceptance of the applicable Work Order deliverable and applicable cleared Customer payments, unless alternative payment milestones are expressly agreed in that Work Order. No additional holding period applies by default."
      : "Payment timing and conditions are as stated in the applicable signed Commercial Schedule or Work Order.",
    minimumPayoutThreshold: acquisition ? "No minimum payout threshold." : "Not applicable — fees are governed by the approved Work Order or applicable fee terms.",
    currencyAndTaxRule:
      "Unless an applicable signed Commercial Schedule or Work Order states otherwise, currency is Nigerian naira (NGN). Fees are exclusive of VAT; VAT, where chargeable, will be added against a valid tax invoice in accordance with applicable law. Any withholding or other statutory deduction required by law may be deducted and remitted to the relevant authority, with evidence of remittance provided to the Partner. Each Party is responsible for its own taxes.",
    splitRule: implementationFee
      ? "No duplicate earning on the same revenue component. A separately approved Channel acquisition commission may apply to qualifying software subscription revenue, and an Implementation Partner may separately earn the fixed or milestone-based implementation fee stated in an approved Work Order for distinct implementation services. These distinct earning bases do not constitute prohibited stacking."
      : "No duplicate commission on the same revenue component. A separately approved implementation fee for distinct services under a signed Work Order may be earned in addition to qualifying software subscription commission; that is not prohibited stacking. Any split of the same revenue component requires express written approval in the signed Commercial Schedule.",
    eligibleItems: channelCommission
      ? CHANNEL_COMMISSION_ELIGIBLE_ITEMS
      : implementationFee
      ? "Approved implementation, configuration, migration, training, testing and handover services expressly listed in the applicable Work Order or Fee Schedule."
      : cat.includes("technology") || cat.includes("payment")
      ? "As stated in the applicable Partner Type Schedule and any signed Work Order."
      : "MartPoint software licence subscriptions on approved plans, as stated in the Partner Type Schedule.",
  }
}

/** Mandatory trigger wording for Referral/Channel acquisition economics (master template rule). */
export const ACQUISITION_TRIGGER_TEXT =
  "No earning for lead registration, acceptance, meetings, demonstrations, quotations, invoices or verbal commitments. " +
  "Eligibility begins only after eligible Customer payment is received and cleared by MartPoint, the required licence " +
  "activation is completed and the holding period and all other conditions are satisfied."

export function defaultTrigger(earningCategory: string): string {
  const cat = earningCategory.toLowerCase()
  if (cat.includes("commission")) return ACQUISITION_TRIGGER_TEXT
  return "Fee becomes payable only when the stated Customer funds and acceptance conditions are met."
}

export const NUMBER_WORDS = ["One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen"]
export const scheduleName = (n: number) => (n <= NUMBER_WORDS.length ? `Schedule ${NUMBER_WORDS[n - 1]}` : `Schedule ${n}`)

export const BLANK = "____________________"
export const orBlank = (v: string | undefined | null) => (v && v.trim() ? v.trim() : BLANK)

export interface Clause {
  num: string
  title: string
  body: string
}

export interface AgreementVars {
  effectiveDate: string
  mpLegal: string
  mpReg: string
  mpAddr: string
  pLegal: string
  pReg: string
  pAddr: string
  disputeDays: string
  securityNoticeHours: string
  liabilityFloor: string
  initialTermMonths: string
  renewalRule: string
  noticeDays: string
  referralProtectionDays: string
  commercialRef: string
  techSolutionName: string
  techSolutionVersion: string
  techUseCase: string
}

export function commonTerms(v: AgreementVars): { part: string | null; clauses: Clause[] }[] {
  return [
    {
      part: null,
      clauses: [
        {
          num: "1",
          title: "Agreement structure",
          body: "This Agreement comprises these Common Terms, the Appointment Summary, every selected Partner Type Schedule, each Commercial or Commission Schedule, and any Work Order, Customer Assignment, Data Processing Addendum, Service Level Schedule or other document expressly incorporated by reference. If there is a conflict, the later specific document controls only for its stated subject, followed by the Partner Type Schedule, the Commercial Schedule and then these Common Terms. No portal message, email or conversation changes the Agreement unless an authorised written amendment says so.",
        },
        {
          num: "2",
          title: "Definitions",
          body: "Approved Materials means current materials MartPoint authorises for the Partner's use. Breach means a Party's failure to perform an obligation, or comply with a restriction, representation or warranty, under this Agreement. Material Breach means a Breach that substantially deprives the other Party of an agreed benefit, materially harms or puts at serious risk a Customer, Personal Data, a payment, security, the platform or legal compliance, or is a repeated failure after written notice. Customer means a business licensed or being evaluated for MartPoint. Eligible Revenue means net revenue actually received and cleared by MartPoint from the qualifying MartPoint software licence subscriptions expressly listed in the Commercial Terms, after approved discounts and excluding taxes, refunds, chargebacks and Excluded Services. Excluded Services means products and services that do not form part of qualifying MartPoint software licence subscription revenue, including separately billed implementation, onboarding, configuration, training, data migration, hardware, third-party products and services, messaging credits, advertising expenditure, automation services, payment processing charges and other ancillary services, unless expressly included in an approved Commercial Schedule. Excluded Services may still earn separate Partner fees where expressly agreed in a Work Order or Commercial Schedule. Partner Account means the individual digital account provided for approved activity. Personal Data has the meaning given by applicable Nigerian data-protection law. Schedules means the documents incorporated into this Agreement. Work Order means a customer-specific or project-specific statement of approved work. A curable Material Breach is subject to the written notice and ten-business-day cure period in the Termination clause; the immediate-termination grounds in that clause remain exceptions.",
        },
      ],
    },
    {
      part: "Common Terms Part One",
      clauses: [
        {
          num: "3",
          title: "Appointment and status",
          body: "MartPoint appoints the Partner on a non-exclusive, revocable basis only for the type, territory, services and term stated in the Appointment Summary. The Partner is an independent business and independent contractor. Nothing creates employment, agency, franchise, fiduciary duty, partnership, joint venture, exclusivity or authority to bind MartPoint. Nothing in this Agreement restricts the Partner from independently providing hardware, networking, power backup, CCTV, data preparation, inventory preparation, training, IT support or other professional services to any customer, including MartPoint Customers, under the Partner's own contractual and commercial arrangements. The Partner may maintain relationships with, promote and represent other software providers. Such activities shall not, by themselves, constitute a conflict of interest, provided the Partner does not misuse MartPoint's confidential information, customer data, intellectual property, authorised access or brand. Activities performed on behalf of MartPoint or requiring access to a MartPoint customer environment remain subject to the applicable Customer Assignment, Work Order or written authorisation. Independent customer contracts remain separate from MartPoint contracts. Revenue under an independent Partner contract belongs to the Partner, and MartPoint receives no share unless the Parties expressly agree otherwise in a signed writing. Each Party bears its own operating costs unless a signed Schedule states otherwise.",
        },
        {
          num: "4",
          title: "Conditions before activity",
          body: "The Partner must complete all required identity, capability, payout, training, security and document checks before activation. Approval of one Partner Type does not approve another. Implementation, technical, payment or customer access requires the applicable certification, Work Order, Customer Assignment or Production Approval. MartPoint may withhold activation until the required evidence is complete.",
        },
        {
          num: "5",
          title: "Partner obligations and performance",
          body: "The Partner shall act honestly and professionally; follow applicable law, this Agreement and Approved Materials; keep accurate records; obtain necessary customer consent; use trained personnel; protect credentials and data; disclose material conflicts relating to MartPoint-authorised activities; report complaints and incidents promptly; cooperate with audits and handovers; and avoid conduct likely to mislead customers or damage MartPoint. Permitted independent services and relationships with other software providers under clause 3 are not, by themselves, a conflict. The initial 90-day activation and activity-monitoring period begins on the activation date stated in MartPoint's Activation Confirmation. During that period, the Partner shall complete agreed onboarding and remain reasonably engaged in approved partnership activity. For activity monitoring only, documented leads, meetings, demonstrations and proposals may be considered; they do not constitute qualifying business delivery for grading or public recognition. All newly approved Partners start Ungraded. Partner Type, Operating Level, Account Status, Partner Grade and Public Directory Status are separate. Standard is an operating level and is not a grade. Ungraded does not prevent agreement generation, signing, activation or onboarding. A Referral Partner qualifying outcome is a distinct referred customer with eligible payment cleared and an activated MartPoint licence. A Channel Partner qualifying outcome is a distinct acquired customer with eligible subscription payment cleared and an activated MartPoint licence. An Implementation Partner qualifying outcome is a distinct authorised implementation completed and formally accepted under an approved Work Order. A Technology Partner qualifying outcome is a distinct customer production integration completed and formally accepted by MartPoint after applicable technical and security review. A Payment Partner qualifying outcome is a distinct approved merchant/payment-service deployment live in production with a successfully settled and reconciled transaction, subject to applicable compliance approval. Leads, meetings, demonstrations, proposals, training and onboarding alone are not qualifying delivery. Fraudulent, refunded, reversed, cancelled or otherwise invalidated acquisitions or transactions do not qualify. A verified outcome creates eligibility for assessment, not automatic grade award or public listing. The Partner Performance, Grading & Progression Policy (MP-POL-PGP-001) maintains a separate grade track for each applicable Partner Type; a Channel + Implementation appointment has two independent tracks. Grade assignment requires assessment against the effective approved policy and written Management approval. Grade assignment requires assessment against the effective policy and written Management approval. Only approved and eligible Partners may be published in the public directory, and a graded badge may be issued only after the grade is formally awarded for the relevant Partner Type. MartPoint may amend the Policy, grade thresholds, assessment criteria and programme benefits to reflect evolving business requirements, ordinarily on 30 days' written notice. Such changes apply prospectively and do not invalidate properly earned financial entitlements or amend signed commercial terms. After directory publication, 90 consecutive calendar days without verified qualifying activity may trigger a written directory suspension notice and a 10-business-day response period. If no qualifying activity is verified and no active review hold or approved extension applies by the end of that period, MartPoint may suspend or remove the public listing. Logins alone do not qualify as activity. A listing suspension alone does not terminate this Agreement, disable the Partner's account or forfeit commissions or fees already properly earned under the applicable Schedule. Grades do not change commercial rights unless a signed Commercial Schedule expressly says so.",
        },
        {
          num: "6",
          title: "MartPoint responsibilities",
          body: "MartPoint will provide the documents, materials, system access and support routes stated for the approved appointment; control software pricing, licensing and deployment; maintain records of accepted opportunities, approved work and eligible earnings; and make payments that have become due under an applicable Schedule. MartPoint does not guarantee leads, sales, customer assignments, minimum income, exclusivity or uninterrupted availability unless a signed Schedule expressly creates that commitment.",
        },
        {
          num: "7",
          title: "No authority and prohibited conduct",
          body: "The Partner shall not bind MartPoint; sign for MartPoint; alter prices, plans, quotas or entitlements; approve discounts; create or activate licences; deploy MartPoint; mark a customer live; collect MartPoint licence payments outside an authorised route; make unapproved warranties; access unassigned customers; share credentials; reverse engineer or copy the platform; use another partner's or customer's information; or subcontract regulated, data-sensitive or customer-facing work without written approval.",
        },
      ],
    },
    {
      part: "Common Terms Part Two",
      clauses: [
        {
          num: "8",
          title: "Customers opportunities and attribution",
          body: "A Customer controls its business account and data. MartPoint controls the software contract, licence administration, invoices and collections. A lead must be registered and accepted before a sale to preserve attribution. Registration, acceptance, qualification, a meeting, demonstration, quotation, invoice or verbal commitment creates no payment entitlement. Duplicate, existing, self-referred, fraudulent or unaccepted opportunities are ineligible. The applicable Schedule governs attribution duration and disputes.",
        },
        {
          num: "9",
          title: "Fees commissions and payment",
          body: "Only a signed Commercial, Commission or Fee Schedule creates an earning. Referral or Channel commission is considered only after the eligible Customer pays MartPoint through an approved route, the funds clear, the required licence activation occurs and all Schedule conditions and holding periods are satisfied. MartPoint may deduct or reverse refunds, chargebacks, taxes required to be withheld, overpayments, fraud-related sums and valid contractual set-offs. The Partner is responsible for its taxes and must provide compliant payout and tax information. No grade or badge changes economics automatically.",
        },
        {
          num: "10",
          title: "Records statements and disputes",
          body: `MartPoint's system records control opportunity timestamps, payments, activations, assignments, milestones, reversals and payouts, subject to correction of proven error. The Partner must raise a statement or attribution dispute within ${v.disputeDays} days after the relevant statement, with supporting evidence. Undisputed amounts may proceed while a disputed item is reviewed.`,
        },
        {
          num: "11",
          title: "Customer access and security",
          body: `Access is personal, least-privilege, purpose-limited and time-limited. The Partner shall use individual accounts, multi-factor authentication where provided, secure devices and approved channels. It shall not request passwords, export data without approval, bypass controls or retain access after assignment. Suspected unauthorised access, credential exposure, malware, fraud or data loss must be reported immediately and no later than ${v.securityNoticeHours} hours after discovery.`,
        },
        {
          num: "12",
          title: "Data protection",
          body: "Each Party shall comply with applicable data-protection requirements. The Partner shall process Personal Data only for an approved purpose, under documented instructions where it acts as processor, and with appropriate safeguards and authorised personnel. This applies to all approved Partner Type activities that involve Personal Data, including referral handling, Channel support, Implementation, Technology integrations and Payment services. The applicable processing particulars must be recorded in a Work Order, Customer Assignment or written processing instruction, and the Data Processing Addendum must be executed before the relevant access or processing begins.",
        },
      ],
    },
    {
      part: "Common Terms Part Three",
      clauses: [
        {
          num: "13",
          title: "Confidentiality",
          body: "Confidential Information includes non-public commercial, pricing, customer, security, product, technical, financial and operational information. The recipient shall use it only for this Agreement, protect it with reasonable care and disclose it only to authorised persons bound by equivalent duties. These duties do not cover information lawfully public, already known without restriction, independently developed or lawfully received from another source. Legally compelled disclosure must be limited and, where lawful, notified in advance. Confidentiality survives for five years after termination, while trade secrets and Personal Data remain protected as long as required by law.",
        },
        {
          num: "14",
          title: "Intellectual property",
          body: "MartPoint and its licensors retain all rights in MartPoint software, documentation, trademarks, designs, methods and improvements. The Partner receives only a limited, non-transferable, revocable right to use Approved Materials during the appointment. Partner pre-existing materials remain the Partner's. Ownership and licensing of custom development, connectors, deliverables and feedback must be stated in the Technology Schedule or Work Order; if omitted, no ownership transfer is implied.",
        },
        {
          num: "15",
          title: "Brand publicity and representations",
          body: "The Partner may use only the current badge, description and assets approved for its recorded type and grade. It shall follow brand instructions, stop using superseded materials and obtain written approval before press releases, paid campaigns, domain names, events, case studies or claims of endorsement. The Partner shall not imply exclusivity, employment, regulatory approval, guaranteed business results or authority beyond the Appointment Summary.",
        },
        {
          num: "16",
          title: "Compliance and ethical conduct",
          body: "Each Party shall comply with applicable anti-bribery, anti-fraud, sanctions, competition, consumer-protection, tax, employment, technology and sector rules. The Partner shall not offer improper payments, falsify leads or evidence, manipulate payouts, misrepresent regulatory status or use deceptive selling practices. A material compliance concern may trigger immediate access restriction while investigated.",
        },
        {
          num: "17",
          title: "Warranties",
          body: "Each Party warrants that it is duly organised or lawfully operating, has authority to enter this Agreement and will comply with applicable law. The Partner also warrants that information and evidence it provides are accurate, its personnel are competent, and its products or deliverables will not knowingly infringe third-party rights. Except as expressly stated, neither Party gives implied warranties to the fullest extent permitted by law.",
        },
      ],
    },
    {
      part: "Common Terms Part Four",
      clauses: [
        {
          num: "18",
          title: "Indemnity",
          body: "Each Party remains responsible for its own independent business activities, contractual obligations, personnel and products. A Party's indemnity under this Agreement applies only to claims and losses arising from activities undertaken in connection with the MartPoint partnership or authorised under this Agreement, a Customer Assignment or a Work Order. The Partner shall indemnify MartPoint against third-party claims, direct losses, regulatory costs and reasonable professional expenses to the extent arising from the Partner's fraud, wilful misconduct, unlawful representations, unauthorised collection, breach of confidentiality or data obligations, infringement by Partner materials, or injury or damage caused by Partner products or personnel in connection with authorised MartPoint activities. Independent products, personnel, services and third-party contracts that have no connection with MartPoint-authorised activities do not, by themselves, fall within this indemnity. MartPoint does not assume liability for hardware, third-party software or independent services supplied by the Partner. Nothing in this clause excludes liability for fraud, unauthorised payments, data breaches, infringement, misconduct or losses arising from authorised MartPoint activities. The indemnified Party shall promptly notify the indemnifying Party and allow reasonable participation in the defence, while retaining control where its reputation, customers, platform or regulator is affected.",
        },
        {
          num: "19",
          title: "Limitation of liability",
          body: `Neither Party is liable for indirect, incidental, special or consequential loss, loss of profit or loss of opportunity, except where such exclusion is prohibited by law. Subject to the exclusions below, each Party's aggregate liability under this Agreement shall not exceed the greater of (a) fees paid or payable to the Partner under this Agreement during the twelve months before the event giving rise to liability or (b) ${v.liabilityFloor}. The cap and exclusions do not apply to fraud, wilful misconduct, death or personal injury caused by negligence, breach of confidentiality, infringement, unauthorised payment collection, data-protection liability, indemnity obligations or amounts properly due.`,
        },
        {
          num: "20",
          title: "Insurance",
          body: "Each Party is independently responsible for maintaining any insurance required by applicable law or considered appropriate for its own business operations. No insurance policy is required solely by reason of appointment to the MartPoint Partner Network. Where a specific engagement requires insurance due to its nature, contractual requirements or associated risks, those requirements shall be expressly stated in the applicable Work Order before acceptance by the Partner. MartPoint is not responsible for purchasing, funding or arranging insurance on behalf of the Partner. Insurance does not limit contractual liability.",
        },
        {
          num: "21",
          title: "Audit and cooperation",
          body: "On reasonable notice, MartPoint may verify compliance, records, customer consent, security controls, qualifications, product approval and amounts claimed. Immediate review is permitted following a serious incident, suspected fraud, regulatory request or material breach. Audits must be proportionate and protect unrelated confidential information. The Partner shall correct confirmed deficiencies within the stated period.",
        },
        {
          num: "22",
          title: "Term review and renewal",
          body: "This Agreement begins on the Effective Date and continues for an initial term of three (3) months. It then automatically renews for successive twelve (12) month periods unless either Party gives written notice of non-renewal at least thirty (30) days before expiry. Either Party may terminate earlier in accordance with this Agreement. Appointment type, grade, certification and access may be reviewed separately. Renewal does not preserve an expired commercial rate unless the applicable Commercial Schedule expressly provides otherwise.",
        },
      ],
    },
    {
      part: "Common Terms Part Five",
      clauses: [
        {
          num: "23",
          title: "Suspension",
          body: "MartPoint may immediately restrict access, assignments, branding or new activity where reasonably necessary to protect customers, data, payments, the platform or regulatory compliance. Grounds include suspected fraud, credential sharing, unauthorised access or collection, data incident, misleading representation, regulatory failure, serious service failure or non-payment. MartPoint will record the reason and review route. Suspension does not erase properly earned undisputed amounts.",
        },
        {
          num: "24",
          title: "Termination",
          body: `Either Party may terminate without cause on ${v.noticeDays} days' written notice. A Party may terminate for material breach not cured within ten business days after notice, or immediately for fraud, illegality, insolvency, serious security or data breach, unauthorised payment collection, deliberate misuse of MartPoint, repeated material failure or conduct likely to cause substantial harm. A specific Schedule or Work Order may end without ending unrelated approved types unless the notice states otherwise.`,
        },
        {
          num: "25",
          title: "Consequences and handover",
          body: "On expiry or termination, the Partner shall stop representing itself as active; cease new activity; return or delete Confidential Information and Personal Data as directed; stop brand use; return property; transfer customer notes, open matters and deliverables; and cooperate in access revocation and customer continuity. MartPoint will reconcile properly earned undisputed sums subject to refunds, reversals, set-offs and Schedule conditions. Clauses intended by nature to survive will remain effective.",
        },
        {
          num: "26",
          title: "Notices",
          body: "Formal notices must be sent to the notice contacts in the Appointment Summary by email and, for termination, material breach or legal process, also by courier or another tracked method. Email is received on the next business day unless delivery failure is shown. Operational portal notifications do not replace formal notice where this Agreement requires it.",
        },
        {
          num: "27",
          title: "Dispute resolution",
          body: "The Parties shall first refer a dispute to their named senior contacts for good-faith resolution within ten business days. If unresolved, they shall attempt mediation in Lagos, Nigeria, unless urgent protective relief is required. If still unresolved within twenty business days after a mediation request, the dispute shall be finally resolved by arbitration under the Arbitration and Mediation Act 2023 by one arbitrator jointly appointed, or appointed under the Act if the Parties cannot agree. The seat is Lagos, the language is English and the award is final and binding. Either Party may seek urgent interim relief from a court of competent jurisdiction.",
        },
        {
          num: "28",
          title: "General",
          body: "Nigerian law governs this Agreement. Neither Party may assign it without the other's written consent, except MartPoint may assign it to an affiliate or successor to the relevant business on notice. The Partner may not subcontract without approval and remains responsible for approved subcontractors. Delay is not waiver. Invalid terms are severed or limited. This Agreement is the entire agreement on its subject and may be amended only in an authorised written instrument. Force majeure excuses affected performance, excluding payment obligations already due, while the event continues and reasonable mitigation occurs.",
        },
        {
          num: "29",
          title: "Electronic execution",
          body: "This Agreement may be signed in counterparts and by an approved electronic or digital signature process. Each counterpart is treated as an original and together they form one instrument. The system shall retain the final document, signer identity, timestamp, consent record and integrity evidence. A Party may request a wet-ink counterpart where legally or operationally necessary.",
        },
      ],
    },
  ]
}

export interface TypeScheduleClause {
  id: string
  title: string
  body: string
}

export function typeScheduleClauses(key: AgreementTypeKey, v: AgreementVars): TypeScheduleClause[] {
  switch (key) {
    case "referral":
      return [
        { id: "R1", title: "Scope", body: "The Partner may identify and introduce genuinely new prospective Customers using approved methods. MartPoint controls qualification, demonstrations, quotations, contracting, payment collection, licensing, deployment and support unless expressly assigned otherwise." },
        { id: "R2", title: "Registration and consent", body: `The Partner must obtain lawful consent to share contact details and register the opportunity before sale. Acceptance protects attribution for ${v.referralProtectionDays} days, subject to duplicate, existing-account and inactivity rules. Acceptance does not create commission.` },
        { id: "R3", title: "Commission trigger", body: "No amount is payable for a name, contact, lead, meeting, demonstration, quotation, invoice or promise to pay. Commission becomes eligible only after the Customer pays MartPoint, the payment clears, the licence is activated, the holding period expires and all Commission Schedule conditions are met." },
        { id: "R4", title: "Boundaries", body: "The Partner receives no customer-account access from referral status, shall not collect licence payments, negotiate unapproved prices, promise features or implementation, or represent itself as authorised to contract for MartPoint." },
        { id: "R5", title: "Commercial reference", body: `Commission rates, eligible products, exclusions, renewals, reversals, holding period, statement cycle and payout timing are stated only in ${v.commercialRef}.` },
        { id: "R6", title: "Performance grades and review", body: "Partner grades are awarded separately for each applicable Partner Type under the MartPoint Partner Performance, Grading & Progression Policy (MP-POL-PGP-001), which is issued as a separate partner resource. A Partner starts Ungraded. The 90-day activity-monitoring period is separate from successful business delivery and does not itself award a grade. Referral registration, meetings, demonstrations, proposals, training and onboarding alone do not qualify. Grade eligibility requires verified qualifying delivery, applicable duration and onboarding, satisfactory customer outcomes and compliance, and Management approval. Eligibility is not an automatic award. Badges and public directory recognition require formal approval and applicable publication eligibility. MartPoint may update the Policy prospectively with notice, ordinarily 30 days; changes do not alter accrued contractual financial entitlements. Any change to signed commercial terms follows the Agreement's written amendment procedure. A grade does not change commission, access, territory or exclusivity unless a signed Commercial Schedule expressly says so." },
      ]
    case "channel":
      return [
        { id: "C1", title: "Scope", body: "The Partner may promote and demonstrate MartPoint, register opportunities, coordinate approved sales activity and provide agreed first-line guidance to Customers assigned in writing. MartPoint remains the contracting, pricing, billing, licensing, deployment and platform owner." },
        { id: "C2", title: "Sales controls", body: "The Partner shall use current Approved Materials and pricing, capture customer requirements accurately, route all quotations and exceptions through MartPoint and ensure payment follows MartPoint's approved collection route." },
        { id: "C3", title: "Customer support", body: "Support access exists only under a Customer Assignment. The Partner shall provide agreed first-line usage guidance, keep service records, complete renewal-support tasks and escalate platform defects. It shall not promise unapproved service levels." },
        { id: "C4", title: "Channel commission", body: `${CHANNEL_COMMISSION_CLAUSE} Acquisition commission requires cleared eligible Customer payment and completed activation. Referral and Channel acquisition rewards do not stack unless an approved split is written into the Schedule.` },
        { id: "C5", title: "Reassignment", body: "A Customer may request reassignment or direct MartPoint support. Earned acquisition commission remains subject to its Schedule; future service-based renewal entitlement depends on active assignment and completed obligations." },
        { id: "C6", title: "Performance grades", body: "Channel grade progression is governed by the separate MartPoint Partner Performance, Grading & Progression Policy (MP-POL-PGP-001). Channel outcomes are distinct acquired Customers with cleared subscription payment and activated licence. The 90-day activity-monitoring period does not by itself award a grade. Grades require the applicable verified outcomes and duration, onboarding, satisfactory customer outcomes and compliance, and formal Management approval. Policy changes apply prospectively with notice, ordinarily 30 days, and do not change accrued contractual financial entitlements or signed commission terms." },
      ]
    case "implementation":
      return [
        { id: "I1", title: "Certification and assignment", body: "The Partner may perform implementation only while certified for the relevant work and under an active Work Order. Each Work Order states Customer, scope, deliverables, dates, access, fee, evidence, acceptance owner and change procedure." },
        { id: "I2", title: "Delivery", body: "After MartPoint provisions the environment, the Partner may perform approved configuration, data preparation, training, testing and handover. It shall protect Customer data, use only assigned access, keep an issue log and correct defects in its work during the acceptance period." },
        { id: "I3", title: "Restrictions and independent services", body: "The Partner shall not deploy MartPoint, create licences, expand scope without a change order, retain access after completion or mark the Customer live. The Partner shall not impose unauthorised charges for services performed on behalf of MartPoint or covered by an approved Work Order. This restriction does not apply to independently contracted services supplied by the Partner under its own terms and fees, provided those services are not misrepresented as MartPoint services or used to circumvent MartPoint's licensing, payment or implementation controls. The Partner remains free to set the prices for its independent services. Separate independent customer contracts do not amend a MartPoint contract." },
        { id: "I4", title: "Acceptance and payment", body: "The Partner submits completion evidence. MartPoint decides acceptance and go-live. The fee is the fixed or milestone amount in the Work Order or Fee Schedule and becomes payable only when the stated Customer funds and acceptance conditions are met." },
        { id: "I5", title: "Data and handover", body: "Where Personal Data is processed, the Data Processing Addendum must be active. At completion or termination, the Partner shall deliver all records, return or delete data, support transition and permit access revocation." },
        { id: "I6", title: "Performance grades", body: "Implementation grade progression is governed by the separate MartPoint Partner Performance, Grading & Progression Policy (MP-POL-PGP-001). Implementation outcomes are distinct customer implementations completed and formally accepted under authorised Work Orders. The 90-day activity-monitoring period does not by itself award a grade. Grades require the applicable verified outcomes and duration, onboarding, applicable certification, satisfactory customer outcomes and compliance, and formal Management approval. Policy changes apply prospectively with notice, ordinarily 30 days, and do not change accrued contractual financial entitlements or signed fees." },
      ]
    case "technology":
      return [
        { id: "T1", title: "Approved solution", body: `Approval is limited to ${v.techSolutionName}, ${v.techSolutionVersion}, for ${v.techUseCase}. Other products, versions, interfaces or use cases require separate review and written approval.` },
        { id: "T2", title: "Technical review and access", body: "The Partner shall provide accurate architecture, data-flow, security, privacy, support and continuity information. Sandbox, API, production, tenant or customer access is granted only to the extent stated in an Integration Work Order or Production Approval." },
        { id: "T3", title: "Development and intellectual property", body: "Deliverables, source code, repositories, background materials, third-party components, licence rights, acceptance, maintenance and escrow or handover obligations are governed by the applicable Work Order. No ownership or source-code right is implied by Technology Partner status." },
        { id: "T4", title: "Support changes and incidents", body: "The Partner owns defects in its product or integration, maintains approved versions, meets applicable service levels, provides advance notice of breaking changes or discontinuation and supports rollback, incident investigation and secure exit." },
        { id: "T5", title: "Commercial treatment", body: `No MartPoint licence discount or commission arises automatically. Product margin, development fee, subscription, usage fee, transaction fee or revenue share exists only as stated in ${v.commercialRef}. A separate software referral follows the Referral Schedule and paid-Customer rule.` },
      ]
    case "payment_provider":
      return [
        { id: "P1", title: "Regulatory status", body: "The Provider warrants that it holds and will maintain every approval, licence, registration and contractual authority required for its services, merchants, processing, settlement and handling of funds. It shall notify MartPoint promptly of restriction, investigation, suspension or material regulatory change." },
        { id: "P2", title: "Fund flow and responsibilities", body: "The approved merchant, payer, collection, settlement, refund and chargeback flow is stated in the Settlement and Reconciliation Schedule. Nothing in this Agreement authorises MartPoint to perform regulated payment activity outside its lawful role." },
        { id: "P3", title: "Security and operations", body: "Before production, the Provider must complete technical, security, privacy, fraud, continuity, support and reconciliation review. It shall maintain appropriate controls, notify incidents within the agreed period and support testing, audit and remediation." },
        { id: "P4", title: "Commercial treatment", body: `Provider fees, rebates, referral payments or revenue shares exist only in ${v.commercialRef}, which must define the revenue base, rate, deductions, taxes, caps, reversals, settlement timing, evidence and audit rights. No payment economics are inferred from Partner status.` },
        { id: "P5", title: "Customer and dispute handling", body: "The Provider shall perform its assigned merchant support, settlement, refund, dispute and chargeback responsibilities and provide complete, accurate statements. A separate software referral follows the Referral Schedule and paid-Customer rule." },
      ]
  }
}
