import { NextResponse } from "next/server"
import {
  callbackSecretIsValid,
  finishAfricaWebhookEvent,
  pick,
  readAfricaRequest,
  resolveAfricaBusinessId,
  storeAfricaWebhookEvent,
  textResponse,
} from "@/lib/africastalking"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  if (!callbackSecretIsValid(request)) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 })

  const { rawBody, payload } = await readAfricaRequest(request)
  const businessId = await resolveAfricaBusinessId(pick(payload, "serviceCode", "shortCode"))
  const eventId = await storeAfricaWebhookEvent({ product: "ussd", endpoint: "ussd", request, rawBody, payload, businessId })

  try {
    const text = pick(payload, "text")
    await finishAfricaWebhookEvent(eventId, "processed")

    if (!text) {
      return textResponse("CON Welcome to MartPoint.\n1. Speak to support\n2. Request a callback\n0. Exit")
    }
    if (text === "0" || text.endsWith("*0")) return textResponse("END Thank you for using MartPoint.")
    if (text === "1" || text.endsWith("*1")) return textResponse("END A support agent will contact you shortly.")
    if (text === "2" || text.endsWith("*2")) return textResponse("END Please send your phone number to MartPoint support for a callback.")
    return textResponse("END Thank you. We have received your request.")
  } catch (error) {
    console.error("[Africa's Talking USSD webhook error]", error)
    await finishAfricaWebhookEvent(eventId, "failed", error instanceof Error ? error.message : "USSD webhook failed")
    return textResponse("END MartPoint is temporarily unavailable. Please try again later.")
  }
}

