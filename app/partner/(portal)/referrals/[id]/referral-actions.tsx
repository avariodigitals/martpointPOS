"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"

const inputCls = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm"

/** The three things a partner may do on their own referral — nothing else. */
export function ReferralActions({
  referralId,
  status,
  requestedInformation,
  responseGiven,
  documents,
}: {
  referralId: string
  status: string
  requestedInformation: string | null
  responseGiven: string | null
  documents: { id: string; label: string }[]
}) {
  const router = useRouter()
  const [text, setText] = useState("")
  const [busy, setBusy] = useState<"submit" | "respond" | string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function act(body: Record<string, unknown>, key: string) {
    setBusy(key)
    setError(null)
    try {
      const res = await fetch(`/api/partner/referrals/${referralId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json.error || "That action could not be completed")
        return
      }
      if (body.action === "open_document") {
        window.open(json.url, "_blank", "noopener")
        return
      }
      setText("")
      router.refresh()
    } catch {
      setError("Network error — please try again")
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-4">
      {error && <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {status === "DRAFT" && (
        <div className="rounded-lg border bg-muted/30 p-4">
          <p className="text-sm font-medium">This referral is still a draft</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Submitting records the date MartPoint reviews it. Consent must already be confirmed on the referral.
          </p>
          <button
            onClick={() => act({ action: "submit" }, "submit")}
            disabled={busy !== null}
            className="mt-3 inline-flex items-center rounded-md bg-retail px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy === "submit" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Submit for review
          </button>
        </div>
      )}

      {status === "INFORMATION_REQUIRED" && requestedInformation && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-medium text-amber-900">MartPoint needs more information</p>
          <p className="mt-1 whitespace-pre-line text-sm text-amber-800">{requestedInformation}</p>
          {responseGiven ? (
            <div className="mt-3 rounded-md border border-amber-200 bg-white/70 p-3">
              <p className="text-xs font-medium text-amber-900">Your last response</p>
              <p className="mt-1 whitespace-pre-line text-sm text-amber-800">{responseGiven}</p>
            </div>
          ) : (
            <div className="mt-3 space-y-2">
              <textarea
                rows={4}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Answer the question above…"
                className={inputCls}
              />
              <button
                onClick={() => act({ action: "provide_information", response: text }, "respond")}
                disabled={busy !== null || !text.trim()}
                className="inline-flex items-center rounded-md bg-retail px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {busy === "respond" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Send response
              </button>
              <p className="text-xs text-amber-700">Sending your response returns the referral to MartPoint review.</p>
            </div>
          )}
        </div>
      )}

      {documents.length > 0 && (
        <div className="rounded-lg border p-4">
          <p className="text-sm font-medium">Documents for this referral</p>
          <ul className="mt-2 space-y-1.5">
            {documents.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-3 text-sm">
                <span>{d.label}</span>
                <button
                  onClick={() => act({ action: "open_document", documentId: d.id }, d.id)}
                  disabled={busy !== null}
                  className="inline-flex items-center rounded-md border px-3 py-1 text-xs font-medium disabled:opacity-50"
                >
                  {busy === d.id && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />}
                  Open
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
