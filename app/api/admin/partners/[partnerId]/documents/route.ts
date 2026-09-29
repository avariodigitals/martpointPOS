import { NextResponse } from "next/server"
import { authorizeAdmin } from "@/lib/admin-auth"
import { isSupabaseConfigured } from "@/lib/supabase"
import {
  listGeneratedDocuments,
  getGeneratedDocumentSignedUrl,
  issueCommissionStatement,
  issueActivationConfirmation,
  issueDpaDocument,
  issueImplementationFeeStatement,
  issueWorkOrderDocument,
  issueTrainingRecordDocument,
  issueUatRecordDocument,
  issueGoLiveDecisionDocument,
  issueCompletionHandoverDocument,
  GENERATED_DOC_TYPE_LABELS,
  type GeneratedDocType,
} from "@/lib/partner-generated-docs"

/* ─── GET: generated documents issued to this partner ─── */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ partnerId: string }> }
) {
  const { denied } = await authorizeAdmin("partners", "view")
  if (denied) return denied
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Not configured" }, { status: 500 })

  const { partnerId } = await params
  const docs = await listGeneratedDocuments(partnerId)
  const documents = await Promise.all(
    docs.map(async (d) => ({
      id: d.id,
      documentId: d.documentId,
      documentType: d.documentType,
      typeLabel: GENERATED_DOC_TYPE_LABELS[d.documentType] || d.documentType,
      title: d.title,
      status: d.status,
      templateVersion: d.templateVersion,
      generatedAt: d.generatedAt,
      acknowledgedAt: d.acknowledgedAt,
      fileSize: d.fileSize,
      checksum: d.checksum,
      signedUrl: await getGeneratedDocumentSignedUrl(d.id),
    }))
  )
  return NextResponse.json({ documents })
}

/* ─── POST: generate a document on demand ───
 * Supports regenerating the Activation Confirmation and issuing ad-hoc
 * records: Commission Statement (period), Implementation Fee Statement
 * (optionally per work order), DPA, UAT Record, plus re-issuing record-bound
 * documents by source id (Work Order, Training Record, Go-Live Decision,
 * Completion/Handover).
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ partnerId: string }> }
) {
  const { session, denied } = await authorizeAdmin("partners", "manage")
  if (denied) return denied
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Not configured" }, { status: 500 })

  const { partnerId } = await params
  try {
    const body = await request.json().catch(() => ({}))
    const type = body?.type as GeneratedDocType

    let result
    switch (type) {
      case "ACTIVATION_CONFIRMATION":
        result = await issueActivationConfirmation(partnerId, session!.userId)
        break
      case "COMMISSION_STATEMENT":
        result = await issueCommissionStatement(
          partnerId,
          {
            from: typeof body?.from === "string" && body.from ? body.from : null,
            to: typeof body?.to === "string" && body.to ? body.to : null,
          },
          session!.userId
        )
        break
      case "DATA_PROCESSING_ADDENDUM":
        result = await issueDpaDocument(partnerId, session!.userId)
        break
      case "IMPLEMENTATION_FEE_STATEMENT":
        result = await issueImplementationFeeStatement(
          partnerId,
          { workOrderId: typeof body?.workOrderId === "string" && body.workOrderId ? body.workOrderId : undefined },
          session!.userId
        )
        break
      case "IMPLEMENTATION_WORK_ORDER":
        if (typeof body?.workOrderId !== "string" || !body.workOrderId) {
          return NextResponse.json({ error: "workOrderId is required" }, { status: 400 })
        }
        result = await issueWorkOrderDocument(body.workOrderId, session!.userId)
        break
      case "TRAINING_RECORD":
        if (typeof body?.trainingRecordId !== "string" || !body.trainingRecordId) {
          return NextResponse.json({ error: "trainingRecordId is required" }, { status: 400 })
        }
        result = await issueTrainingRecordDocument(body.trainingRecordId, session!.userId)
        break
      case "COMPLETION_HANDOVER_RECORD":
        if (typeof body?.workOrderId !== "string" || !body.workOrderId) {
          return NextResponse.json({ error: "workOrderId is required" }, { status: 400 })
        }
        result = await issueCompletionHandoverDocument(body.workOrderId, session!.userId)
        break
      case "GO_LIVE_DECISION": {
        if (typeof body?.businessId !== "string" || !body.businessId) {
          return NextResponse.json({ error: "businessId is required" }, { status: 400 })
        }
        const decision = String(body?.decision || "")
        if (!["APPROVED", "DEFERRED", "DECLINED"].includes(decision)) {
          return NextResponse.json({ error: "decision must be APPROVED, DEFERRED or DECLINED" }, { status: 400 })
        }
        result = await issueGoLiveDecisionDocument(
          body.businessId,
          {
            decision: decision as "APPROVED" | "DEFERRED" | "DECLINED",
            conditions: typeof body?.conditions === "string" ? body.conditions : null,
            deploymentWindow: typeof body?.deploymentWindow === "string" ? body.deploymentWindow : null,
            readinessSummary: typeof body?.readinessSummary === "string" ? body.readinessSummary : null,
          },
          { id: session!.userId, name: session!.name }
        )
        break
      }
      case "UAT_RECORD": {
        if (typeof body?.customerName !== "string" || !body.customerName) {
          return NextResponse.json({ error: "customerName is required" }, { status: 400 })
        }
        const decision = String(body?.decision || "")
        if (!["ACCEPTED", "CONDITIONALLY_ACCEPTED", "REJECTED"].includes(decision)) {
          return NextResponse.json({ error: "decision must be ACCEPTED, CONDITIONALLY_ACCEPTED or REJECTED" }, { status: 400 })
        }
        const approver = body?.customerApprover || {}
        if (typeof approver.name !== "string" || !approver.name) {
          return NextResponse.json({ error: "customerApprover.name is required" }, { status: 400 })
        }
        result = await issueUatRecordDocument(
          partnerId,
          {
            customerName: body.customerName,
            systemVersion: typeof body?.systemVersion === "string" ? body.systemVersion : null,
            testDates: typeof body?.testDates === "string" ? body.testDates : null,
            scenarios: Array.isArray(body?.scenarios) ? body.scenarios : [],
            defects: Array.isArray(body?.defects) ? body.defects : [],
            decision: decision as "ACCEPTED" | "CONDITIONALLY_ACCEPTED" | "REJECTED",
            decisionNotes: typeof body?.decisionNotes === "string" ? body.decisionNotes : null,
            customerApprover: { name: approver.name, email: typeof approver.email === "string" ? approver.email : "" },
          },
          session!.userId
        )
        break
      }
      default:
        return NextResponse.json({ error: "Unsupported document type" }, { status: 400 })
    }

    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
    return NextResponse.json({ success: true, document: result.document })
  } catch {
    return NextResponse.json({ error: "Failed to generate document" }, { status: 500 })
  }
}
