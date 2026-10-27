import { NextResponse } from "next/server"
import { checkRateLimit } from "@/lib/rate-limit"
import { getComplianceDocumentByToken, submitComplianceBankDetailsByToken, submitComplianceDocumentByToken } from "@/lib/partner-compliance"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get("token")
  if (!token) {
    return NextResponse.json({ error: "Upload token is required" }, { status: 400 })
  }

  const result = await getComplianceDocumentByToken(token)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  return NextResponse.json({ doc: result.doc })
}

export async function POST(request: Request) {
  const limited = await checkRateLimit(request, { key: "partner-compliance-upload", max: 10, windowSeconds: 3600 })
  if (!limited.allowed) {
    return NextResponse.json({ error: "Too many upload attempts. Please try again later." }, { status: 429 })
  }

  try {
    if (request.headers.get("content-type")?.includes("application/json")) {
      const body = await request.json()
      if (typeof body.token !== "string") return NextResponse.json({ error: "Token is required" }, { status: 400 })
      const result = await submitComplianceBankDetailsByToken(body.token, {
        bankName: typeof body.bankName === "string" ? body.bankName : "",
        accountName: typeof body.accountName === "string" ? body.accountName : "",
        accountNumber: typeof body.accountNumber === "string" ? body.accountNumber : "",
      })
      if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
      return NextResponse.json({ success: true })
    }
    const formData = await request.formData()
    const token = formData.get("token") as string | null
    const file = formData.get("file") as File | null

    if (!token || !file) {
      return NextResponse.json({ error: "Token and file are required" }, { status: 400 })
    }

    const result = await submitComplianceDocumentByToken(token, file)
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Upload failed. Please try again or contact support." }, { status: 500 })
  }
}
