import crypto from "crypto"
import { NextResponse } from "next/server"
import { checkRateLimit, checkRateLimitSync } from "@/lib/rate-limit"
import { PARTNER_DOCUMENTS_BUCKET } from "@/lib/partner-documents"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { withTimeout } from "@/lib/with-timeout"

export const dynamic = "force-dynamic"

const validToken = (token: string) => /^[a-f0-9]{64}$/i.test(token)
const tokenHash = (token: string) => crypto.createHash("sha256").update(token).digest("hex")

async function loadSigningDocument(token: string) {
  return supabase.from("partner_agreement_signing")
    .select("application_id,source_document_id,agreement_id,status,token_expires_at,final_document_path")
    .eq("token_hash", tokenHash(token))
    .maybeSingle()
}

async function loadSourceDocument(sourceDocumentId: string, applicationId: string) {
  return supabase.from("partner_documents")
    .select("storage_path,original_filename")
    .eq("id", sourceDocumentId)
    .eq("application_id", applicationId)
    .maybeSingle()
}

export async function GET(request: Request) {
  const rateOptions = { key: "partner-agreement-signing-document", max: 20, windowSeconds: 600 }
  const limited = await withTimeout(checkRateLimit(request, rateOptions), 3000, "Rate limit timed out")
    .catch(() => checkRateLimitSync(request, rateOptions))
  if (!limited.allowed) return NextResponse.json({ error: "Too many document requests. Please try again shortly." }, { status: 429 })
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Agreement document is not available" }, { status: 503 })

  const token = new URL(request.url).searchParams.get("token") || ""
  if (!validToken(token)) return NextResponse.json({ error: "This signing link is invalid or expired" }, { status: 404 })

  let signingResult
  try {
    signingResult = await withTimeout(loadSigningDocument(token), 8000, "Signing request lookup timed out")
  } catch (error) {
    console.error("[agreement PDF] signing lookup failed:", error)
    return NextResponse.json({ error: "Agreement is temporarily unavailable. Please try again." }, { status: 503 })
  }
  if (signingResult.error) {
    console.error("[agreement PDF] signing query failed:", signingResult.error.message)
    return NextResponse.json({ error: "Agreement is temporarily unavailable. Please try again." }, { status: 503 })
  }
  const signing = signingResult.data
  if (!signing) return NextResponse.json({ error: "This signing link is invalid or expired" }, { status: 404 })
  if (signing.status === "AWAITING_PARTNER" && new Date(signing.token_expires_at as string) <= new Date()) {
    return NextResponse.json({ error: "This signing link has expired" }, { status: 410 })
  }
  if (!["AWAITING_PARTNER", "EXECUTED"].includes(String(signing.status))) {
    return NextResponse.json({ error: "This signing link has been replaced" }, { status: 410 })
  }

  let storagePath = signing.final_document_path as string | null
  let filename = `MartPoint-Partner-Agreement-${String(signing.agreement_id)}.pdf`
  if (!storagePath) {
    const documentResult = await withTimeout(
      loadSourceDocument(String(signing.source_document_id), String(signing.application_id)),
      8000,
      "Agreement document lookup timed out"
    ).catch((error) => ({ data: null, error }))
    if (documentResult.error) {
      console.error("[agreement PDF] document lookup failed:", documentResult.error)
      return NextResponse.json({ error: "Agreement is temporarily unavailable. Please try again." }, { status: 503 })
    }
    storagePath = documentResult.data?.storage_path as string | null
    filename = String(documentResult.data?.original_filename || filename)
  }
  if (!storagePath) return NextResponse.json({ error: "The agreement PDF could not be found" }, { status: 404 })

  const download = await withTimeout(
    supabase.storage.from(PARTNER_DOCUMENTS_BUCKET).download(storagePath),
    12000,
    "Agreement PDF download timed out"
  ).catch((error) => ({ data: null, error }))
  if (download.error || !download.data) {
    console.error("[agreement PDF] private storage download failed:", download.error)
    return NextResponse.json({ error: "The agreement PDF could not be downloaded. Please try again." }, { status: 503 })
  }

  const safeFilename = filename.replace(/[\r\n"\\]/g, "_")
  return new NextResponse(await download.data.arrayBuffer(), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${safeFilename}"`,
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  })
}
