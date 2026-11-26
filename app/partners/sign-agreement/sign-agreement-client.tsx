"use client"

import { useEffect, useState, type FormEvent } from "react"
import { FileCheck2, Loader2, PenLine } from "lucide-react"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { Button } from "@/components/ui/button"

export type SigningDetails = {
  agreementId: string
  status: string
  partnerName: string
  signerEmail: string
  martpointSigner: { name: string; title: string; signedAt: string }
  expiresAt: string
  documentUrl: string | null
  partnerSignerName: string
}

export default function SignPartnerAgreementClient({
  token,
  initialDetails,
  initialError,
}: {
  token: string
  initialDetails: SigningDetails | null
  initialError: string
}) {
  const [details, setDetails] = useState<SigningDetails | null>(initialDetails)
  const [signerName, setSignerName] = useState(initialDetails?.partnerSignerName || "")
  const [signerTitle, setSignerTitle] = useState("")
  const [confirmAuthority, setConfirmAuthority] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading] = useState(Boolean(token) && !initialDetails)
  const [error, setError] = useState(initialError)
  const [completeUrl, setCompleteUrl] = useState("")

  useEffect(() => {
    if (!token || initialDetails) return
    const controller = new AbortController()
    fetch(`/api/partners/sign-agreement?token=${encodeURIComponent(token)}`, {
      cache: "no-store",
      signal: controller.signal,
    }).then(async (response) => {
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "This signing link is unavailable.")
      setDetails(data as SigningDetails)
      setSignerName(data.partnerSignerName || "")
      setError("")
    }).catch((cause) => {
      if (controller.signal.aborted) return
      setError(cause instanceof Error ? cause.message : "Could not load the agreement. Refresh the page or contact MartPoint.")
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false)
    })
    return () => controller.abort()
  }, [initialDetails, token])

  async function signAgreement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError("")
    try {
      const response = await fetch("/api/partners/sign-agreement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, signerName, signerTitle, confirmAuthority }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Could not sign the agreement.")
      setCompleteUrl(data.finalUrl || "")
      setDetails((current) => current ? { ...current, status: "EXECUTED", partnerSignerName: signerName } : current)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not sign the agreement.")
    } finally {
      setSubmitting(false)
    }
  }

  const executed = details?.status === "EXECUTED"

  return (
    <>
      <Header />
      <main className="flex-1 bg-muted/30">
        <div className="container-martpoint py-10 md:py-16">
          <section className="mx-auto max-w-2xl rounded-2xl border bg-background p-6 shadow-sm md:p-8">
            <div className="mb-6 flex items-center gap-3 text-retail">
              <FileCheck2 className="h-6 w-6" />
              <p className="text-xs font-semibold uppercase tracking-widest">Partner Agreement</p>
            </div>
            {error && !details ? (
              <div><h1 className="text-2xl font-bold">Signing link unavailable</h1><p className="mt-3 text-muted-foreground">{error}</p></div>
            ) : details ? (
              <>
                <h1 className="text-2xl font-bold">{executed ? "Agreement signed" : "Review and sign your agreement"}</h1>
                <p className="mt-2 text-muted-foreground">{details.partnerName} · Agreement {details.agreementId}</p>
                {details.documentUrl && <a className="mt-5 inline-flex items-center gap-2 text-retail underline" href={details.documentUrl} target="_blank" rel="noreferrer"><FileCheck2 className="h-4 w-4" />{executed ? "Download executed agreement" : "Review agreement PDF"}</a>}
                <div className="mt-6 rounded-lg border bg-muted/30 p-4 text-sm">
                  <p className="font-medium">MartPoint has signed electronically</p>
                  <p className="mt-1">{details.martpointSigner.name} · {details.martpointSigner.title}</p>
                  <p className="text-muted-foreground">The electronic signature and signing time are recorded in the agreement.</p>
                </div>
                {executed ? (
                  <div className="mt-6 rounded-lg bg-emerald-50 p-4 text-sm text-emerald-900">
                    The agreement has been signed by both parties. MartPoint has sent the completed copy to {details.signerEmail}.
                    {completeUrl && <p className="mt-3"><a className="underline" href={completeUrl} target="_blank" rel="noreferrer">Download your signed copy</a></p>}
                  </div>
                ) : (
                  <form className="mt-6 space-y-4" onSubmit={signAgreement}>
                    <label className="block text-sm font-medium">Your full legal name
                      <input required minLength={3} autoComplete="name" value={signerName} onChange={(e) => setSignerName(e.target.value)} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2" />
                    </label>
                    <label className="block text-sm font-medium">Your title / authority to sign
                      <input required minLength={2} autoComplete="organization-title" value={signerTitle} onChange={(e) => setSignerTitle(e.target.value)} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2" placeholder="e.g. Managing Director" />
                    </label>
                    <label className="flex items-start gap-2 text-sm">
                      <input type="checkbox" checked={confirmAuthority} onChange={(e) => setConfirmAuthority(e.target.checked)} />
                      <span>I confirm I am authorised to sign this agreement for the partner named above. I intend my typed name and submission to be my electronic signature and agree to the terms in the linked PDF.</span>
                    </label>
                    {error && <p className="text-sm text-red-600">{error}</p>}
                    <Button type="submit" disabled={submitting || !confirmAuthority}>
                      {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Signing…</> : <><PenLine className="mr-2 h-4 w-4" />Sign agreement</>}
                    </Button>
                    <p className="text-xs text-muted-foreground">This private link is sent to {details.signerEmail} and expires {new Date(details.expiresAt).toLocaleString("en-NG")}.</p>
                  </form>
                )}
              </>
            ) : loading ? <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div> : <div><h1 className="text-2xl font-bold">Signing link unavailable</h1><p className="mt-3 text-muted-foreground">This signing link is invalid or expired.</p></div>}
          </section>
        </div>
      </main>
      <Footer />
    </>
  )
}
