import SignPartnerAgreementClient from "./sign-agreement-client"

export const dynamic = "force-dynamic"
export const metadata = { robots: { index: false, follow: false } }

export default async function SignPartnerAgreementPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token = "" } = await searchParams
  return <SignPartnerAgreementClient token={token} initialDetails={null} initialError={token ? "" : "This signing link is invalid or expired."} />
}
