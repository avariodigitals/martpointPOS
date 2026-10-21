import fs from "node:fs"
import path from "node:path"
import { jsPDF } from "jspdf"

const OUT = path.join(process.cwd(), "output", "pdf")
fs.mkdirSync(OUT, { recursive: true })

const BLUE = [0, 87, 255]
const DARK = [17, 24, 39]
const BODY = [55, 65, 81]
const MUTED = [107, 114, 128]

function addHeader(doc, label, title, subtitle) {
  const w = doc.internal.pageSize.getWidth()
  doc.setFillColor(...BLUE)
  doc.rect(0, 0, w, 9, "F")
  doc.setFont("helvetica", "bold")
  doc.setFontSize(20)
  doc.setTextColor(...BLUE)
  doc.text("MartPoint", 48, 45)
  doc.setFontSize(8)
  doc.setTextColor(...MUTED)
  doc.text("hello@martpoint.com.ng  |  martpoint.com.ng", w - 48, 43, { align: "right" })
  doc.setDrawColor(...BLUE)
  doc.line(48, 58, w - 48, 58)
  doc.setFontSize(8)
  doc.setTextColor(...MUTED)
  doc.text(label.toUpperCase(), 48, 78)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(22)
  doc.setTextColor(...DARK)
  doc.text(title, 48, 105)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(10)
  doc.setTextColor(...BODY)
  wrap(doc, subtitle, 48, 126, w - 96, 14)
  return 158
}

function wrap(doc, text, x, y, width, lineHeight = 13) {
  const lines = doc.splitTextToSize(text, width)
  for (const line of lines) {
    doc.text(line, x, y)
    y += lineHeight
  }
  return y
}

function ensure(doc, y, needed = 40, footerRef = "MartPoint Partner Guide") {
  const h = doc.internal.pageSize.getHeight()
  if (y + needed <= h - 55) return y
  footer(doc, footerRef)
  doc.addPage()
  return 48
}

function footer(doc, ref) {
  const w = doc.internal.pageSize.getWidth()
  const h = doc.internal.pageSize.getHeight()
  doc.setDrawColor(229, 231, 235)
  doc.line(48, h - 40, w - 48, h - 40)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(8)
  doc.setTextColor(...MUTED)
  doc.text(ref, 48, h - 25)
  doc.text(`Page ${doc.getCurrentPageInfo().pageNumber}`, w - 48, h - 25, { align: "right" })
}

function section(doc, y, number, title, paragraphs, bullets, ref) {
  y = ensure(doc, y, 92, ref)
  doc.setFillColor(...BLUE)
  doc.circle(59, y - 4, 10, "F")
  doc.setFont("helvetica", "bold")
  doc.setFontSize(9)
  doc.setTextColor(255, 255, 255)
  doc.text(String(number), 59, y - 1, { align: "center" })
  doc.setFontSize(13)
  doc.setTextColor(...DARK)
  doc.text(title, 78, y)
  y += 20
  doc.setFont("helvetica", "normal")
  doc.setFontSize(9.5)
  doc.setTextColor(...BODY)
  for (const paragraph of paragraphs) {
    y = ensure(doc, y, 30, ref)
    y = wrap(doc, paragraph, 78, y, 464, 13) + 5
  }
  for (const bullet of bullets) {
    y = ensure(doc, y, 28, ref)
    doc.setFillColor(...BLUE)
    doc.circle(84, y - 3, 2, "F")
    y = wrap(doc, bullet, 94, y, 448, 13) + 3
  }
  return y + 10
}

function callout(doc, y, title, text, color, ref) {
  y = ensure(doc, y, 65, ref)
  const lines = doc.splitTextToSize(text, 438)
  const height = 30 + lines.length * 12
  doc.setFillColor(...color.fill)
  doc.setDrawColor(...color.border)
  doc.roundedRect(48, y - 14, 500, height, 7, 7, "FD")
  doc.setFont("helvetica", "bold")
  doc.setFontSize(9.5)
  doc.setTextColor(...color.text)
  doc.text(title, 62, y + 2)
  doc.setFont("helvetica", "normal")
  y = wrap(doc, text, 62, y + 17, 438, 12)
  return y + 16
}

function saveGuide(fileName, label, title, subtitle, sections, callouts = []) {
  const doc = new jsPDF({ unit: "pt", format: "a4" })
  const ref = `MartPoint ${label}`
  let y = addHeader(doc, label, title, subtitle)
  for (const item of sections) y = section(doc, y, item[0], item[1], item[2], item[3], ref)
  for (const item of callouts) y = callout(doc, y, item[0], item[1], item[2], ref)
  footer(doc, ref)
  fs.writeFileSync(path.join(OUT, fileName), Buffer.from(doc.output("arraybuffer")))
}

const amber = { fill: [255, 251, 235], border: [245, 158, 11], text: [120, 53, 15] }
const green = { fill: [236, 253, 245], border: [16, 185, 129], text: [6, 78, 59] }
const blue = { fill: [239, 246, 255], border: [0, 87, 255], text: [30, 58, 138] }

saveGuide(
  "martpoint-partner-portal-guide.pdf",
  "Partner Portal Guide",
  "Partner Portal: screen-by-screen guide",
  "From first login through lead registration, quote requests, customer onboarding, invoices, commissions and support.",
  [
    [1, "Log in and change your password", ["Open Partner Login and enter the email address and password for your partner user account. Select Sign In.", "If you cannot remember the password, select Forgot password, enter your email, and select Send Reset Link. Open the email link, enter a password of at least 10 characters, confirm it, and select Reset Password."], ["The reset page does not reveal whether an email is registered. Check your inbox and spam folder."]],
    [2, "Dashboard, profile and team", ["The Dashboard is your starting screen. Use the sidebar to open Leads, Quotes, Customers, Work Orders, Earnings, Documents, Training, Compliance and Support."], ["Keep Profile information current.", "Use Team to invite approved colleagues and assign the correct partner role.", "Read notifications about referrals, documents, assignments, payouts and account status."]],
    [3, "Create a lead", ["Open My Leads, select Register Lead, complete the form, and submit it. Required fields include business name, contact name, phone, email, country, state, city, industry, business type and interested product."], ["Add branches, estimated users, deal value and notes when known.", "Use real customer details and confirm permission to share them with MartPoint.", "Protection reserves an opportunity; it is not approval, a quote, an invoice or a commission."]],
    [4, "Request, review and accept a quote", ["Open Quote Requests, select a protected registered lead, and enter plan or product, locations, estimated users, services requested, and notes or assumptions. Select Request quote. When Sales issues the linked Finance quote, open the request to review, download, and record acceptance or decline."], ["The request is reviewed by MartPoint Sales.", "Statuses are Submitted, Under review, Quote issued, Declined and Expired.", "An accepted quote is not a payment or invoice yet."]],
    [5, "After the quote request", ["Wait for the status and quote reference in Quotes. Discuss the approved proposal with the customer, but do not change MartPoint pricing, promise discounts, or issue an invoice yourself."], ["Admin reviews the request and chooses Reviewing, Issue quote or Decline.", "If the customer accepts, Admin moves the opportunity into the normal customer and Finance workflow."]],
    [6, "How the customer receives and pays the invoice", ["After the accepted quote is converted, MartPoint creates and issues the formal invoice for the customer business. The invoice is emailed to the business primary email with the invoice number, due date, balance due and PDF attachment."], ["The customer pays by bank transfer using the invoice number as reference.", "The partner can submit the amount, bank reference, and proof from the assigned customer Finance screen.", "The submission remains pending until Admin/Finance verifies and confirms the payment.", "The customer receives payment confirmation and a receipt."]],
    [7, "Customer onboarding and work orders", ["Open My Customers to view assigned businesses, contact details, access level, business status and deployment status. If you have onboarding-manager access, follow the customer onboarding workspace."], ["Use Work Orders for approved implementation or delivery work.", "Record milestone evidence in the work order.", "Do not activate licences, collect licence payments, or promise unsupported features without written authority."]],
    [8, "Documents, commission, payout and support", ["Documents contains the Referral Partner Agreement, Commission Schedule, activation records, assignments, statements and notices. Select Preview / download to open an issued document."], ["Earnings follows protection, holding, eligibility, approval and payout.", "The signed Commission Schedule controls the rates and timing.", "Use Support for access, lead, customer, document and payout questions."]],
  ],
  [
    ["Important system boundary", "The partner starts the quote handoff and can accept the linked Finance quote. Admin/Sales still creates the quote and invoice, while Finance verifies and confirms any payment proof. The partner must not issue a parallel invoice or mark a payment paid.", amber],
    ["What partners can see", "Partners can see assigned customer and permitted onboarding information. Ask Admin for an invoice number or payment status rather than creating a second invoice.", green],
  ]
)

saveGuide(
  "martpoint-admin-partner-module-guide.pdf",
  "Admin Partner Module Guide",
  "Partner Module: admin operating guide",
  "From application review and commercial setup through activation, engagement, customer invoicing, onboarding and commission close.",
  [
    [1, "Application intake", ["Use Partners -> Applications for people who want to become MartPoint partners. Use Prospects for an unattributed prospect who may be invited to apply."], ["Do not invite a partner-owned customer lead to become a partner.", "Partner-owned leads stay in the partner referral workflow."]],
    [2, "Review application, meetings and assessment", ["Open the application reference. Confirm identity, business details, requested partner type, geography, experience, documents, assessment results and discovery notes. Record meetings and follow-up, request more information when needed, then approve, reject or conditionally approve."], []],
    [3, "Create and preview the Agreement", ["On the partner record, create the agreement draft and progress it through Legal review, Commercial review, Approved for signature, Sent for signature and Executed."], ["Use Bring into force only when the version should govern the live relationship.", "Use Generate preview or Preview document to inspect the stored document.", "Confirm the document appears in the partner Documents screen."]],
    [4, "Create the Commission Schedule", ["Select Draft new version. Enter first-year rate, first-renewal rate, protection days, holding days, payout days after month-end, approved split and the justification for non-standard terms."], ["Standard terms shown are 10% first year, 5% first renewal, 90-day protection, 30-day holding and 14 days after month-end.", "The signed schedule controls the commission engine; do not create a code exception.", "Generate a preview and confirm the partner can open it in Documents."]],
    [5, "Activation gates and portal access", ["Verify the partner record and identity, executed Agreement, executed Commission Schedule, payout and tax profile, orientation and conduct acknowledgement. Resolve every missing readiness gate before activation."], ["Use the Users tab to invite the owner or additional partner users.", "Activate only when all required gates are green.", "Activation creates the activation confirmation document."]],
    [6, "First engagement: lead to quote", ["The partner registers the customer opportunity. Admin reviews the lead, status, protection, duplicate or matching information and requested information. When the partner submits a quote request, create the real Finance quote first, then enter its quote number when issuing the request."], ["Reviewing means Sales is working on the request.", "Issue quote requires the approved Finance quote number and a decision note.", "The partner can review/download and accept or decline the linked quote.", "An accepted quote is not a payment, customer conversion, invoice or commission."]],
    [7, "Customer acceptance to formal invoice", ["When the customer is ready to buy, confirm the customer business record and primary contact email. If needed, review Referral Decisions and convert the referral when the business is ready."], ["Open Finance -> Invoices.", "Create the invoice for the customer business, add agreed line items, check due date, public notes, tax and total.", "Select Issue. The system emails the primary contact and attaches a PDF.", "Use Send to resend and Send reminder for a due or overdue balance."]],
    [8, "Payment and receipt handoff", ["The invoice email tells the customer to quote the invoice number when paying by bank transfer. The partner may submit the amount, bank reference, and proof from the assigned customer Finance screen. Admin or Finance verifies and confirms the payment, then sends payment confirmation and receipt."], ["The partner submission is pending evidence only; it is not confirmation.", "The partner must not issue a parallel invoice or mark a payment paid."]],
    [9, "Onboarding and engagement", ["Open Onboarding for the converted customer. Initiate onboarding, send setup questions, review responses and documents, update stages and send access details when ready."], ["Track intake, payment confirmation, information, setup review, provisioning, business setup, training and completion.", "Use the Work Orders tab on the partner record for approved scope, fees, due dates, milestones and evidence.", "Keep credentials and sensitive customer information in the approved workflow."]],
    [10, "Commission close and troubleshooting", ["Acceptance starts protection; it does not create a commission. Eligibility depends on the active signed schedule, eligible collected revenue, activation where required, holding period, payment confirmation and Finance approval."], ["Use Finance -> Commission Close for month-end review, approval, scheduling and payout.", "Use Payout Requests and Bank Changes for partner payouts and re-verification.", "If documents are missing, generate their previews from the signed instruments panel.", "If an invoice is not received, verify the primary email and that the invoice is Issued rather than Draft."]],
  ],
  [
    ["Key quote-to-cash rule", "A partner Quote Request starts the handoff. Admin/Sales creates the real Finance quote, enters its quote number, and issues it. The partner/customer can accept it. Admin then converts the accepted quote into an invoice; Finance verifies the submitted payment proof.", amber],
    ["Operating principle", "Record every material decision in the relevant screen. The partner portal is for partner-facing status and work; customer billing and payment confirmation remain Admin and Finance responsibilities.", blue],
  ]
)

console.log(`Created PDFs in ${OUT}`)
