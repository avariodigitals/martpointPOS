import { headers } from "next/headers"
import SignPartnerAgreementClient, { type SigningDetails } from "./sign-agreement-client"

export const dynamic = "force-dynamic"
export const metadata = { robots: { index: false, follow: false } }

export default async function SignPartnerAgreementPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token = "" } = await searchParams
  let details: SigningDetails | null = null
  let error = token ? "Could not load the agreement. Refresh the page or contact MartPoint." : "This signing link is invalid or expired."

  if (token) {
    try {
      const requestHeaders = await headers()
      const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host")
      if (!host) throw new Error("The signing host is unavailable.")
      const protocol = requestHeaders.get("x-forwarded-proto")?.split(",")[0]?.trim()
        || (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https")
      const forwardedFor = requestHeaders.get("x-forwarded-for")
      const response = await fetch(
        `${protocol}://${host}/api/partners/sign-agreement?token=${encodeURIComponent(token)}`,
        {
          cache: "no-store",
          headers: forwardedFor ? { "x-forwarded-for": forwardedFor } : undefined,
        },
      )
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "This signing link is unavailable.")
      details = data as SigningDetails
      error = ""
    } catch (cause) {
      error = cause instanceof Error ? cause.message : error
    }
  }

  return <SignPartnerAgreementClient token={token} initialDetails={details} initialError={error} />
}
