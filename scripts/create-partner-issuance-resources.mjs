import fs from "node:fs"
import path from "node:path"
import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"

const outputDir = path.resolve("public/partner-resources")
fs.mkdirSync(outputDir, { recursive: true })
const blue = [0, 87, 255]
const ink = [25, 34, 52]
const muted = [103, 112, 131]

function createDoc(ref, status) {
  const doc = new jsPDF({ unit: "pt", format: "a4" })
  const margin = 42
  const width = doc.internal.pageSize.getWidth()
  let page = 1
  let cursor = 130
  function footer() {
    const height = doc.internal.pageSize.getHeight()
    doc.setDrawColor(226, 231, 239)
    doc.line(margin, height - 34, width - margin, height - 34)
    doc.setFont("helvetica", "normal")
    doc.setFontSize(8)
    doc.setTextColor(...muted)
    doc.text(`${ref} | ${status}`, margin, height - 20)
    doc.text(String(page), width - margin, height - 20, { align: "right" })
  }
  function newPage() { footer(); doc.addPage(); page++; cursor = 48; doc.lastAutoTable = { finalY: 0 } }
  function heading(title, level = 1) {
    const y = cursor + (level === 1 ? 12 : 8)
    doc.setFont("helvetica", "bold")
    doc.setFontSize(level === 1 ? 14 : 11)
    doc.setTextColor(...(level === 1 ? blue : ink))
    doc.text(title, margin, y)
    cursor = y + (level === 1 ? 20 : 16)
    return cursor
  }
  function paragraph(text, y, size = 9.5) {
    doc.setFont("helvetica", "normal")
    doc.setFontSize(size)
    doc.setTextColor(...ink)
    const lines = doc.splitTextToSize(text, width - margin * 2)
    doc.text(lines, margin, y)
    cursor = y + lines.length * (size + 3) + 8
    return cursor
  }
  function table(title, rows, y = 70) {
    if (title) {
      doc.setFont("helvetica", "bold")
      doc.setFontSize(12)
      doc.setTextColor(...blue)
      doc.text(title, margin, y)
      y += 12
    }
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [["Field", "Value"]],
      body: rows,
      theme: "grid",
      styles: { font: "helvetica", fontSize: 8, cellPadding: 5, textColor: ink, overflow: "linebreak" },
      headStyles: { fillColor: blue, textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [247, 249, 252] },
      columnStyles: { 0: { cellWidth: 150, fontStyle: "bold" }, 1: { cellWidth: "auto" } },
      rowPageBreak: "avoid",
    })
    cursor = doc.lastAutoTable.finalY + 18
    return cursor
  }
  function title(name, id, subtitle) {
    doc.setFillColor(247, 249, 255)
    doc.rect(0, 0, width, 118, "F")
    doc.setFont("helvetica", "bold")
    doc.setFontSize(11)
    doc.setTextColor(...blue)
    doc.text("MARTPOINT", margin, 32)
    doc.setFontSize(21)
    doc.setTextColor(...ink)
    doc.text(name, margin, 62)
    doc.setFont("helvetica", "normal")
    doc.setFontSize(9)
    doc.setTextColor(...muted)
    doc.text(`${id} | ${subtitle}`, margin, 82)
    doc.setFont("helvetica", "bold")
    doc.setFontSize(9)
    doc.setTextColor(160, 57, 27)
    doc.text(status, margin, 101)
    cursor = 130
    doc.lastAutoTable = { finalY: 118 }
  }
  return { doc, margin, width, title, heading, paragraph, table, newPage, footer }
}

// Illustrative Work Order: sample terms only; it creates no customer or fee commitment.
{
  const ref = "SAMPLE-WO-001"
  const status = "ILLUSTRATIVE SAMPLE - NOT AN OFFER OR FINANCIAL COMMITMENT"
  const d = createDoc(ref, status)
  d.title("IMPLEMENTATION WORK ORDER", ref, "Partner resource")
  let y = d.heading("1. Purpose")
  y = d.paragraph("This example shows the information to complete for a specific approved customer assignment. A real Work Order must be completed, approved by MartPoint and accepted by the Partner before billable work or customer-environment access begins.", y)
  y = d.table("2. Project reference", [
    ["Partner", "Named Partner under an active MartPoint Partner Agreement"],
    ["Customer and location", "To be stated in the issued Work Order"],
    ["MartPoint owner", "Named authorised MartPoint contact"],
    ["Start and target dates", "Agreed project dates"],
  ], y)
  y = d.table("3. Illustrative scope and responsibilities", [
    ["Scope", "Configure an approved MartPoint environment; prepare agreed customer data; onboard named users; deliver agreed training; test the configuration; and hand over the completed environment."],
    ["Deliverables", "Approved configuration record; data import/reconciliation record if applicable; attendance/training record; test results; open-issues log; and handover confirmation."],
    ["Partner responsibilities", "Use authorised personnel and least-privilege access; follow documented instructions; protect customer data; report incidents promptly; document work; and obtain written approval before any scope change."],
    ["MartPoint responsibilities", "Provide the approved environment, project owner, applicable configuration instructions and timely decisions; review submitted deliverables; and coordinate customer dependencies."],
    ["Customer responsibilities", "Provide accurate source data, named users, timely decisions and access approvals required by the agreed scope."],
    ["Exclusions", "Hardware, third-party products, unlisted custom development and work not expressly listed in the signed Work Order."],
  ], y)
  y = d.table("4. Fees, milestones and payment", [
    ["Fee method", "Fixed or milestone-based fees expressly stated in the issued Work Order. No amount is set by this sample."],
    ["Milestones", "For each milestone, state the deliverable, due date, acceptance evidence and fee amount or calculation method."],
    ["Payment conditions", "Unless the Work Order expressly sets alternative milestones, accepted implementation fees are payable within 15 days after the applicable monthly statement is issued, subject to formal Work Order acceptance and applicable cleared Customer payments. No additional holding period applies by default."],
    ["Tax and currency", "State the agreed currency and tax treatment in the issued Work Order; this sample makes no tax or currency commitment."],
    ["Expenses", "No expense is reimbursable unless expressly approved in writing in the issued Work Order."],
  ], y)
  d.newPage()
  y = d.heading("5. Review and acceptance")
  y = d.paragraph("MartPoint will review each submitted deliverable within five (5) business days, unless a different period is stated in the issued Work Order. MartPoint will either confirm acceptance in writing or identify the unmet agreed criteria. Silence, elapsed time or submission of evidence does not itself constitute acceptance. The Partner will correct identified defects within the period stated in the issued Work Order.", y)
  y = d.table("6. Change control, access and data", [
    ["Change control", "Out-of-scope work, additional fees or date changes require a written Change Order approved by both Parties before the changed work starts."],
    ["Access", "List the approved systems, permissions, named users and access period. Access must be least-privilege and time-limited."],
    ["Data protection", "Complete the applicable processing particulars in this Work Order, Customer Assignment or written instruction, and execute the applicable DPA before personal data is accessed."],
    ["Insurance", "No insurance is required for the standard Partner appointment. Any project-specific requirement must be stated and accepted here before the Work Order is signed."],
  ], y)
  y = d.heading("7. Approval and signatures")
  y = d.paragraph("This sample is not signed, does not appoint a Partner to a Customer, does not approve access, and does not create any financial commitment. Only a completed Work Order expressly issued by MartPoint and accepted by the Partner controls the specific project.", y)
  d.table("Signature record", [
    ["For MartPoint", "Authorised representative, title, signature and date - complete on the issued Work Order"],
    ["For the Partner", "Authorised representative, title, signature and date - complete on the issued Work Order"],
  ], y)
  d.footer()
  fs.writeFileSync(path.join(outputDir, "MartPoint-Illustrative-Implementation-Work-Order.pdf"), Buffer.from(d.doc.output("arraybuffer")))
}

// Reusable DPA overview. Engagement-specific processing particulars are completed before access.
{
  const ref = "MP-DPA-TEMPLATE-001"
  const status = "TEMPLATE - NOT EXECUTED; PROCESSING DETAILS REQUIRED BEFORE ACCESS"
  const d = createDoc(ref, status)
  d.title("DATA PROCESSING ADDENDUM", ref, "Partner resource")
  let y = d.heading("Purpose and application")
  y = d.paragraph("This Addendum applies when a Partner processes personal data for a MartPoint engagement under documented instructions, including approved Channel Partner support and Implementation Partner work. The Parties must complete and sign the applicable Addendum and record the actual processing particulars before access or processing begins. Appointment to the Partner Network alone does not authorise personal-data processing.", y)
  y = d.table("1. Engagement particulars - complete before access", [
    ["Partner and MartPoint legal entities", "Insert the parties and registered addresses for the engagement"],
    ["Work Order / Customer Assignment", "Record the controlling assignment reference"],
    ["Processing relationship and roles", "Identify whether each Party acts as controller, processor or independent controller for the specific operation"],
    ["Purpose and duration", "Specify the approved purpose and processing period"],
    ["Data subjects and data categories", "Specify affected individuals and personal-data categories"],
    ["Operations and documented instructions", "List the permitted actions and written instructions"],
    ["Systems, locations and subprocessors", "List approved systems, processing locations and any approved subprocessors"],
  ], y)
  y = d.table("2. Core safeguards", [
    ["Instructions and purpose", "Process only for the recorded purpose and documented instructions; notify the controller if an instruction appears unlawful."],
    ["Confidentiality and access", "Use authorised personnel, individual accounts, least-privilege permissions and timely access revocation."],
    ["Security", "Maintain proportionate technical and organisational safeguards, including secure configuration, transmission, logging, backup and incident response."],
    ["Incidents", "Notify the other affected Party without undue delay and no later than four (4) hours after discovery of a suspected or actual security or personal-data incident. Preserve evidence, contain the incident, provide updates and cooperate. This four-hour duty does not extend any shorter statutory or contractual deadline."],
    ["Subprocessors and transfers", "Obtain prior written approval and document appropriate protections before subprocessors or international transfers receive access."],
    ["Requests and cooperation", "Promptly refer data-subject and regulator requests to the responsible controller and provide reasonable assistance."],
    ["Return and deletion", "At the end of the approved purpose, return or securely delete personal data unless law requires retention."],
  ], y)
  d.newPage()
  y = d.heading("3. Records, audit and precedence")
  y = d.paragraph("Each processor will maintain records reasonably necessary to demonstrate its safeguards and will support proportionate compliance reviews. The Parties will follow applicable data-protection law. This Addendum supplements the Partner Agreement for the specific processing engagement. If terms conflict, the term providing greater protection to personal data or security applies; nothing in this Addendum or a Work Order may weaken the Agreement's four-hour incident reporting duty, any stricter signed protection or statutory requirement. The Agreement controls on other subjects.", y)
  y = d.table("4. Conditions before processing", [
    ["Documented scope", "Complete the engagement particulars above in the Work Order, Customer Assignment or written instruction."],
    ["Execution", "Obtain signatures from authorised representatives of both Parties before access."],
    ["Access approval", "Confirm approved systems, personnel, locations and duration; grant only the permissions needed."],
    ["Changes", "Document and approve material changes to purpose, data, locations or subprocessors before they take effect."],
  ], y)
  y = d.heading("5. Execution record")
  y = d.paragraph("This reusable template is not an executed DPA. The engagement-specific parties, roles, instructions, processing particulars, effective date and authorised signatures must be completed before it is relied upon for access or processing.", y)
  d.table("Signature record", [
    ["For MartPoint", "Authorised representative, title, signature and date - complete in the issued Addendum"],
    ["For the Partner", "Authorised representative, title, signature and date - complete in the issued Addendum"],
  ], y)
  d.footer()
  fs.writeFileSync(path.join(outputDir, "MartPoint-Partner-Data-Processing-Addendum-Template.pdf"), Buffer.from(d.doc.output("arraybuffer")))
}

console.log(`Created partner issuance reference PDFs in ${outputDir}`)
