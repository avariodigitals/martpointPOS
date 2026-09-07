import { NextResponse } from "next/server"
import {
  authenticateCustomerByEmail,
  createCustomerSupportSession,
  verifySupportMagicToken,
} from "@/lib/customer-support-auth"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const token = url.searchParams.get("token")
  const base = process.env.NEXT_PUBLIC_BASE_URL || url.origin

  const fail = (reason: string) =>
    NextResponse.redirect(`${base}/support?error=${encodeURIComponent(reason)}`)

  if (!token) return fail("missing_token")

  const payload = verifySupportMagicToken(token)
  if (!payload) return fail("invalid_or_expired_link")

  // Re-verify the business still exists and is active before issuing a session.
  const business = await authenticateCustomerByEmail(payload.email)
  if (!business || business.id !== payload.businessId) {
    return fail("invalid_or_expired_link")
  }

  await createCustomerSupportSession(business)
  return NextResponse.redirect(`${base}/support/tickets`)
}
