import { NextResponse } from "next/server"
import { processFlutterwaveWebhook } from "@/lib/payment-gateways"

export async function POST(request: Request) {
  try {
    const body = await request.text()
    const signature = request.headers.get("verif-hash") || ""
    const result = await processFlutterwaveWebhook(body, signature)
    return NextResponse.json(result, { status: result.success ? 200 : 400 })
  } catch (e) {
    console.error("[flutterwave webhook]", e)
    return NextResponse.json({ success: false, message: "Webhook processing failed" }, { status: 500 })
  }
}
