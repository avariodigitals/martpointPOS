import { NextResponse } from "next/server"
import { processPaystackWebhook } from "@/lib/payment-gateways"

export async function POST(request: Request) {
  try {
    const body = await request.text()
    const signature = request.headers.get("x-paystack-signature") || ""
    const result = await processPaystackWebhook(body, signature)
    return NextResponse.json(result, { status: result.success ? 200 : 400 })
  } catch (e) {
    console.error("[paystack webhook]", e)
    return NextResponse.json({ success: false, message: "Webhook processing failed" }, { status: 500 })
  }
}
