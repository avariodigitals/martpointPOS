import type { PartnerType } from "./partners"

/* ───────────────────  Partner Agreement content (master template v1.0)  ───────────────────
 * Partner-facing wording ONLY. The master .docx is an internal "LEGAL AND AUTOMATION
 * MASTER" that also carries generation rules, internal approval logic, merge-field
 * documentation and a legal review checklist — none of which belongs in a partner's
 * signing copy. Conditional markers ([[INCLUDE IF …]]) are resolved here by selecting
 * schedules per approved partner type; unused schedules are omitted entirely.
 */

export const AGREEMENT_TEMPLATE_VERSION = "1.0"

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
  const keys = agreementTypeKeys(partnerType)
  if (keys.includes("payment_provider")) {
    return "Appropriate professional, cyber and financial-crime insurance as required by applicable regulation."
  }
  if (keys.includes("technology")) {
    return "Appropriate professional and cyber liability insurance."
  }
  if (keys.includes("implementation")) {
    return "Professional indemnity insurance appropriate to the implementation engagement."
  }
  return "None required unless stated by MartPoint in writing."
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
          body: "Approved Materials means current materials MartPoint authorises for the Partner's use. Customer means a business licensed or being evaluated for MartPoint. Eligible Revenue means net software revenue actually received and cleared by MartPoint after approved discounts, excluding taxes, refunds, chargebacks, hardware, third-party charges and excluded services. Partner Account means the individual digital account provided for approved activity. Personal Data has the meaning given by applicable Nigerian data-protection law. Schedules means the documents incorporated into this Agreement. Work Order means a customer-specific or project-specific statement of approved work.",
        },
      ],
    },
    {
      part: "Common Terms Part One",
      clauses: [
        {
          num: "3",
          title: "Appointment and status",
          body: "MartPoint appoints the Partner on a non-exclusive, revocable basis only for the type, territory, services and term stated in the Appointment Summary. The Partner is an independent contractor. Nothing creates employment, agency, franchise, fiduciary duty, partnership, joint venture, exclusivity or authority to bind MartPoint. The Partner bears its own operating costs unless a signed Schedule states otherwise.",
        },
        {
          num: "4",
          title: "Conditions before activity",
          body: "The Partner must complete all required identity, capability, payout, training, security and document checks before activation. Approval of one Partner Type does not approve another. Implementation, technical, payment or customer access requires the applicable certification, Work Order, Customer Assignment or Production Approval. MartPoint may withhold activation until the required evidence is complete.",
        },
        {
          num: "5",
          title: "Partner obligations",
          body: "The Partner shall act honestly and professionally; follow applicable law, this Agreement and Approved Materials; keep accurate records; obtain necessary customer consent; use trained personnel; protect credentials and data; disclose conflicts; report complaints and incidents promptly; cooperate with audits and handovers; and avoid conduct likely to mislead customers or damage MartPoint.",
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
          body: "Each Party shall comply with the Nigeria Data Protection Act 2023, applicable directives and other binding privacy requirements. The Partner shall process Personal Data only for the approved purpose, on documented instructions where MartPoint is controller, using appropriate safeguards and authorised personnel. It shall support data-subject requests, breach response, deletion, return and audit. Where processing scope requires it, the Parties must execute the Data Processing Addendum before access begins.",
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
          body: "The Partner shall indemnify MartPoint against third-party claims, direct losses, regulatory costs and reasonable professional expenses arising from the Partner's fraud, wilful misconduct, unlawful representations, unauthorised collection, breach of confidentiality or data obligations, infringement by Partner materials, or injury or damage caused by Partner products or personnel. MartPoint shall promptly notify the Partner and allow reasonable participation in the defence, while retaining control where MartPoint's reputation, customers, platform or regulator is affected.",
        },
        {
          num: "19",
          title: "Limitation of liability",
          body: `Neither Party is liable for indirect, incidental, special or consequential loss, loss of profit or loss of opportunity, except where such exclusion is prohibited by law. Subject to the exclusions below, each Party's aggregate liability under this Agreement shall not exceed the greater of (a) fees paid or payable to the Partner under this Agreement during the twelve months before the event giving rise to liability or (b) ${v.liabilityFloor}. The cap and exclusions do not apply to fraud, wilful misconduct, death or personal injury caused by negligence, breach of confidentiality, infringement, unauthorised payment collection, data-protection liability, indemnity obligations or amounts properly due.`,
        },
        {
          num: "20",
          title: "Insurance",
          body: "Where stated in the Appointment Summary or a Schedule, the Partner shall maintain appropriate professional, public, product, cyber or other insurance and provide evidence on request. Insurance does not limit contractual liability.",
        },
        {
          num: "21",
          title: "Audit and cooperation",
          body: "On reasonable notice, MartPoint may verify compliance, records, customer consent, security controls, qualifications, product approval and amounts claimed. Immediate review is permitted following a serious incident, suspected fraud, regulatory request or material breach. Audits must be proportionate and protect unrelated confidential information. The Partner shall correct confirmed deficiencies within the stated period.",
        },
        {
          num: "22",
          title: "Term review and renewal",
          body: `This Agreement begins on the Effective Date and continues for ${v.initialTermMonths} months, then ${v.renewalRule}, unless ended earlier. Appointment type, grade, certification and access may be reviewed separately. Renewal does not preserve an expired commercial rate unless the applicable Schedule says so.`,
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
      ]
    case "channel":
      return [
        { id: "C1", title: "Scope", body: "The Partner may promote and demonstrate MartPoint, register opportunities, coordinate approved sales activity and provide agreed first-line guidance to Customers assigned in writing. MartPoint remains the contracting, pricing, billing, licensing, deployment and platform owner." },
        { id: "C2", title: "Sales controls", body: "The Partner shall use current Approved Materials and pricing, capture customer requirements accurately, route all quotations and exceptions through MartPoint and ensure payment follows MartPoint's approved collection route." },
        { id: "C3", title: "Customer support", body: "Support access exists only under a Customer Assignment. The Partner shall provide agreed first-line usage guidance, keep service records, complete renewal-support tasks and escalate platform defects. It shall not promise unapproved service levels." },
        { id: "C4", title: "Commission trigger", body: `Acquisition commission requires cleared eligible Customer payment and completed activation. Renewal commission applies only for the periods in ${v.commercialRef} while the Partner remains assigned and fulfils the stated service obligations. Referral and Channel acquisition rewards do not stack unless an approved split is written into the Schedule.` },
        { id: "C5", title: "Reassignment", body: "A Customer may request reassignment or direct MartPoint support. Earned acquisition commission remains subject to its Schedule; future service-based renewal entitlement depends on active assignment and completed obligations." },
      ]
    case "implementation":
      return [
        { id: "I1", title: "Certification and assignment", body: "The Partner may perform implementation only while certified for the relevant work and under an active Work Order. Each Work Order states Customer, scope, deliverables, dates, access, fee, evidence, acceptance owner and change procedure." },
        { id: "I2", title: "Delivery", body: "After MartPoint provisions the environment, the Partner may perform approved configuration, data preparation, training, testing and handover. It shall protect Customer data, use only assigned access, keep an issue log and correct defects in its work during the acceptance period." },
        { id: "I3", title: "Restrictions", body: "The Partner shall not deploy MartPoint, create licences, expand scope without a change order, retain access after completion, mark the Customer live or charge the Customer outside the approved arrangement." },
        { id: "I4", title: "Acceptance and payment", body: "The Partner submits completion evidence. MartPoint decides acceptance and go-live. The fee is the fixed or milestone amount in the Work Order or Fee Schedule and becomes payable only when the stated Customer funds and acceptance conditions are met." },
        { id: "I5", title: "Data and handover", body: "Where Personal Data is processed, the Data Processing Addendum must be active. At completion or termination, the Partner shall deliver all records, return or delete data, support transition and permit access revocation." },
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
