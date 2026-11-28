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
  let initialDetails: SigningDetails | null = null
  let initialError = token ? "" : "This signing link is invalid or expired."

  if (token) {
    try {
      const requestHeaders = await headers()
      const host = (requestHeaders.get("x-forwarded-host") || requestHeaders.get("host"))?.split(",")[0].trim()
      if (!host) throw new Error("The signing page could not determine its host")
      const protocol = requestHeaders.get("x-forwarded-proto")?.split(",")[0]?.trim() || "https"
      const apiUrl = new URL(`/api/partners/sign-agreement?token=${encodeURIComponent(token)}`, `${protocol}://${host}`)
      const response = await fetch(apiUrl, {
        cache: "no-store",
        headers: {
          "x-forwarded-for": requestHeaders.get("x-forwarded-for") || "",
        },
        signal: AbortSignal.timeout(12000),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || "This signing link is unavailable.")
      initialDetails = data as SigningDetails
    } catch (cause) {
      initialError = cause instanceof Error
        ? cause.message
        : "We could not load this agreement. Refresh the page or contact MartPoint."
    }
  }

  return <SignPartnerAgreementClient token={token} initialDetails={initialDetails} initialError={initialError} />
}
