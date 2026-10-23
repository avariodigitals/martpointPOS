import { NextResponse } from "next/server"
import {
  callbackSecretIsValid,
  finishAfricaWebhookEvent,
  pick,
  readAfricaRequest,
  resolveAfricaBusinessId,
  storeAfricaWebhookEvent,
} from "@/lib/africastalking"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  if (!callbackSecretIsValid(request)) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 })

  const { rawBody, payload } = await readAfricaRequest(request)
  const businessId = await resolveAfricaBusinessId(pick(payload, "phoneNumber", "recipient", "phone"))
  const eventId = await storeAfricaWebhookEvent({ product: "airtime", endpoint: "airtime/events", request, rawBody, payload, businessId })

  try {
    await finishAfricaWebhookEvent(eventId, "processed")
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[Africa's Talking Airtime webhook error]", error)
    await finishAfricaWebhookEvent(eventId, "failed", error instanceof Error ? error.message : "Airtime webhook failed")
    return NextResponse.json({ ok: true })
  }
}

