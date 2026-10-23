"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { LocationFields } from "@/components/location-fields"
import { businessTypeOptions } from "@/lib/industries"
import { Loader2 } from "lucide-react"

const inputCls = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
const labelCls = "block text-sm font-medium mb-1"
const hintCls = "mt-1 text-xs text-muted-foreground"

const RELATIONSHIP_OPTIONS = [
  "I know the owner or manager personally",
  "Existing business relationship (I supply or serve them)",
  "Met at a trade event or in my network",
  "They are a customer of my own business",
  "Found them online or through social media",
  "Other",
]

const CURRENT_SYSTEM_OPTIONS = [
  "No system — manual / paper",
  "Spreadsheets",
  "Another POS or ERP (please name it in the notes)",
  "Not sure",
]

export default function NewReferralPage() {
  const router = useRouter()
  const formRef = useRef<HTMLFormElement>(null)
  const [saving, setSaving] = useState<"draft" | "submit" | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState<{ id: string; reference: string; duplicateWarning: string | null } | null>(null)

  const [country, setCountry] = useState("")
  const [state, setState] = useState("")
  const [city, setCity] = useState("")
  const [consent, setConsent] = useState(false)

  async function send(e: React.SyntheticEvent, asDraft: boolean) {
    e.preventDefault()
    setError(null)

    const form = formRef.current
    if (!form) return
    const fd = new FormData(form)
    const read = (key: string) => String(fd.get(key) ?? "").trim()
    const numberOrNull = (key: string) => {
      const raw = read(key)
      return raw ? Number(raw) : null
    }

    if (!asDraft && !consent) {
      setError("Confirm that the prospect agreed to be introduced before submitting.")
      return
    }

    setSaving(asDraft ? "draft" : "submit")
    try {
      const res = await fetch("/api/partner/referrals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName: read("businessName"),
          contactName: read("contactName"),
          phone: read("phone"),
          email: read("email"),
          country: read("country"),
          state: read("state"),
          city: read("city"),
          businessType: read("businessType"),
          estimatedBranches: numberOrNull("estimatedBranches"),
          estimatedUsers: numberOrNull("estimatedUsers"),
          currentSystem: read("currentSystem"),
          knownRequirement: read("knownRequirement"),
          relationshipSource: read("relationshipSource"),
          notes: read("notes") || null,
          consentConfirmed: consent,
          asDraft,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error || "Could not save this referral")
        setSaving(null)
        return
      }
      if (asDraft) {
        router.push("/partner/referrals")
        return
      }
      // Confirmation stays on screen: the reference and any duplicate notice are
      // the partner's first sight of the review outcome.
      setSaved({
        id: json.referral.id,
        reference: json.referral.reference,
        duplicateWarning: json.duplicateWarning || null,
      })
      setSaving(null)
      window.scrollTo({ top: 0, behavior: "smooth" })
    } catch {
      setError("Network error — your referral was not saved. Please try again.")
      setSaving(null)
    }
  }

  if (saved) {
    return (
      <div className="max-w-2xl space-y-4">
        <div className="rounded-lg border border-teal-200 bg-teal-50 p-5">
          <h2 className="text-lg font-semibold text-teal-900">Referral submitted</h2>
          <p className="mt-1 text-sm text-teal-800">
            Your reference is <span className="font-mono">{saved.reference}</span>. MartPoint Sales will review it and
            record the decision in your portal. You will get a notification when there is a decision.
          </p>
          {saved.duplicateWarning && (
            <p className="mt-3 rounded-md border border-amber-200 bg-white/70 p-3 text-sm text-amber-800">
              {saved.duplicateWarning}
            </p>
          )}
          <p className="mt-3 text-xs text-teal-700">
            A submitted referral is not yet accepted, and neither status creates a commission.
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href={`/partner/referrals/${saved.id}`}
            className="inline-flex items-center rounded-md bg-retail px-4 py-2 text-sm font-medium text-white hover:bg-retail/90"
          >
            Track this referral
          </Link>
          <Link href="/partner/referrals" className="inline-flex items-center rounded-md border px-4 py-2 text-sm font-medium">
            All my referrals
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Refer a business</h2>
        <p className="text-sm text-muted-foreground">
          Introduce a business that is genuinely new to MartPoint, before any sale is made.
        </p>
      </div>

      {error && <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <form ref={formRef} onSubmit={(e) => send(e, false)} className="max-w-2xl space-y-5">
        <div className="space-y-4 rounded-lg border p-4">
          <h3 className="text-sm font-semibold">The business you are introducing</h3>
          <div>
            <label className={labelCls}>Business name *</label>
            <input name="businessName" required className={inputCls} placeholder="As the business trades" />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Contact name *</label>
              <input name="contactName" required className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Phone *</label>
              <input name="phone" required className={inputCls} placeholder="08012345678" />
            </div>
          </div>
          <div>
            <label className={labelCls}>Email</label>
            <input name="email" type="email" className={inputCls} />
            <p className={hintCls}>Leave blank if you only have a phone number.</p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <LocationFields
              country={country}
              state={state}
              city={city}
              required
              inputClassName={inputCls}
              onChange={(values) => {
                setCountry(values.country ?? country)
                setState(values.state ?? state)
                setCity(values.city ?? city)
              }}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className={labelCls}>Business type *</label>
              <select name="businessType" required className={inputCls} defaultValue="">
                <option value="" disabled>Select type</option>
                {businessTypeOptions.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Branches</label>
              <input name="estimatedBranches" type="number" min={1} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Staff who would use it</label>
              <input name="estimatedUsers" type="number" min={1} className={inputCls} />
            </div>
          </div>
        </div>

        <div className="space-y-4 rounded-lg border p-4">
          <h3 className="text-sm font-semibold">What they need</h3>
          <div>
            <label className={labelCls}>How you know this business *</label>
            <select name="relationshipSource" required className={inputCls} defaultValue="">
              <option value="" disabled>Select one</option>
              {RELATIONSHIP_OPTIONS.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>How they run sales today</label>
            <select name="currentSystem" className={inputCls} defaultValue="">
              <option value="">Select one</option>
              {CURRENT_SYSTEM_OPTIONS.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>What they told you they need *</label>
            <textarea name="knownRequirement" required rows={3} className={inputCls} placeholder="e.g. stock tracking across two branches and a receipt printer at the till" />
            <p className={hintCls}>Describe their need in their words. Do not quote prices, promise discounts or commit to features or dates.</p>
          </div>
          <div>
            <label className={labelCls}>Anything else MartPoint should know</label>
            <textarea name="notes" rows={2} className={inputCls} />
          </div>
        </div>

        <div className="rounded-lg border bg-muted/30 p-4">
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={consent}
              onChange={(ev) => setConsent(ev.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-input"
            />
            <span className="text-sm">
              I told this business I am introducing MartPoint, and they agreed I could share their contact details.
              <span className={hintCls}>
                Referrals without consent are removed and repeated consent failures can close a partner account.
              </span>
            </span>
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={saving !== null || !consent}
            className="inline-flex items-center rounded-md bg-retail px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {saving === "submit" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Submit referral
          </button>
          <button
            type="button"
            disabled={saving !== null}
            onClick={(e) => send(e, true)}
            className="inline-flex items-center rounded-md border px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {saving === "draft" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save as draft
          </button>
          <Link href="/partner/referrals" className="text-sm text-muted-foreground hover:underline">
            Cancel
          </Link>
        </div>
        {!consent && <p className="text-xs text-muted-foreground">Tick the consent confirmation to submit. Drafts can be saved without it.</p>}
      </form>
    </div>
  )
}
