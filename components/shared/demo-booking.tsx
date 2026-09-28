"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { CheckCircle, Loader2, Video, ArrowLeft, RefreshCw } from "lucide-react"
import { businessTypeOptions } from "@/lib/industries"
import { CaptchaField, type CaptchaState, type CaptchaFieldHandle } from "@/components/captcha-field"
import { SlotPicker } from "@/components/shared/slot-picker"

const WHATSAPP_NUMBER = "+2348036028069"

const detailsSchema = z.object({
  fullName: z.string().min(2, "Full name is required"),
  businessName: z.string().min(2, "Business name is required"),
  email: z.string().email("Valid email is required"),
  phone: z.string().min(10, "Valid phone number is required"),
  businessType: z.string().min(1, "Business type is required"),
  productInterest: z.string().min(1),
  message: z.string().optional(),
})

type DetailsData = z.infer<typeof detailsSchema>

interface SlotFeed {
  slots: string[]
  timezone: string
  durationMinutes: number
}

interface BookedInfo {
  scheduledAt: string
  durationMinutes: number
  meetingLink: string | null
  meetPending: boolean
}

function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "Africa/Lagos"
  } catch {
    return "Africa/Lagos"
  }
}

const productOptions = [
  { value: "retail", label: "MartPoint Retail" },
  { value: "erp", label: "MartPoint ERP" },
  { value: "not-sure", label: "Not Sure — Need Guidance" },
]

function waUrl(text: string) {
  return `https://wa.me/${WHATSAPP_NUMBER.replace("+", "")}?text=${encodeURIComponent(text)}`
}

export function DemoBooking({ partnerCode }: { partnerCode?: string }) {
  const [step, setStep] = useState<"pick" | "details" | "done">("pick")
  const [feed, setFeed] = useState<SlotFeed | null>(null)
  const [slotsError, setSlotsError] = useState("")
  const [loadingSlots, setLoadingSlots] = useState(true)
  const [tz, setTz] = useState(() => (typeof window === "undefined" ? "Africa/Lagos" : browserTimeZone()))
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [booked, setBooked] = useState<BookedInfo | null>(null)
  const [captcha, setCaptcha] = useState<CaptchaState>({ configured: false, token: null })
  const captchaRef = useRef<CaptchaFieldHandle>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<DetailsData>({
    resolver: zodResolver(detailsSchema),
    defaultValues: { productInterest: "not-sure" },
  })

  const loadSlots = async () => {
    setLoadingSlots(true)
    setSlotsError("")
    try {
      const res = await fetch("/api/demo-slots", { cache: "no-store" })
      const data = await res.json()
      if (!res.ok || !Array.isArray(data.slots)) throw new Error(data.error || "Failed")
      setFeed(data)
      setTz((current) => current || browserTimeZone())
    } catch {
      setSlotsError("Could not load available times. Please try again.")
    } finally {
      setLoadingSlots(false)
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch
    void loadSlots()
  }, [])

  const fmtFull = (iso: string) =>
    new Date(iso).toLocaleString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: tz,
    })

  const onSubmit = async (data: DetailsData) => {
    if (!selectedSlot) return
    setSubmitting(true)
    setError("")
    const captchaToken = (await captchaRef.current?.execute()) ?? null
    if (captcha.configured && !captchaToken) {
      setSubmitting(false)
      setError("Please complete the security check before submitting.")
      return
    }

    try {
      const res = await fetch("/api/demo-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          slot: selectedSlot,
          timezone: tz,
          partnerCode: partnerCode || undefined,
          captchaToken: captchaToken || undefined,
        }),
      })
      const result = await res.json()

      if (!res.ok) {
        if (res.status === 409 || res.status === 410) {
          // Slot got taken — refresh availability and send them back to step 1.
          setSelectedSlot(null)
          setStep("pick")
          await loadSlots()
        }
        setError(result.error || "Could not complete the booking. Please try another time.")
        return
      }

      const info: BookedInfo = {
        scheduledAt: result.scheduledAt,
        durationMinutes: result.durationMinutes,
        meetingLink: result.meetingLink,
        meetPending: Boolean(result.meetPending),
      }
      setBooked(info)
      setStep("done")

      const waText = [
        `Hi, I just booked a MartPoint demo for ${fmtFull(result.scheduledAt)} (${tz}).`,
        `Name: ${data.fullName}`,
        `Business: ${data.businessName}`,
      ].join("\n")
      window.open(waUrl(waText), "_blank")
    } catch {
      setError("Something went wrong. Please try again or contact us on WhatsApp.")
    } finally {
      setSubmitting(false)
    }
  }

  const waConfirmUrl = useMemo(() => {
    if (!booked) return "#"
    return waUrl(`Hi, I just booked a MartPoint demo for ${fmtFull(booked.scheduledAt)} (${tz}).`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booked, tz])

  /* ─── Success ─── */
  if (step === "done" && booked) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="rounded-2xl border border-success/20 bg-success/5 p-10 text-center">
          <div className="w-14 h-14 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-7 h-7 text-success" />
          </div>
          <h3 className="text-2xl font-bold text-foreground mb-2">You&apos;re booked!</h3>
          <p className="text-muted-foreground leading-relaxed max-w-md mx-auto mb-2">
            Your demo is confirmed for
          </p>
          <p className="text-lg font-semibold text-foreground mb-1">{fmtFull(booked.scheduledAt)}</p>
          <p className="text-sm text-muted-foreground mb-6">
            {booked.durationMinutes} minutes · {tz}
          </p>

          {booked.meetingLink ? (
            <div className="rounded-xl border border-border bg-background p-4 max-w-sm mx-auto mb-6">
              <div className="flex items-center justify-center gap-2 text-sm font-medium mb-2">
                <Video className="w-4 h-4" /> Google Meet link
              </div>
              <a href={booked.meetingLink} target="_blank" rel="noopener noreferrer" className="text-sm text-retail break-all underline">
                {booked.meetingLink}
              </a>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">
              {booked.meetPending
                ? "Your Google Meet link is being set up — it will arrive by email shortly."
                : "A confirmation email with your meeting details is on its way."}
            </p>
          )}

          <div className="rounded-xl border border-retail/20 bg-retail-soft p-5 max-w-sm mx-auto">
            <p className="text-sm font-semibold text-foreground mb-2">One last step</p>
            <p className="text-xs text-muted-foreground mb-3">
              Send us a quick WhatsApp message so we can confirm instantly and share anything you need before the call.
            </p>
            <a
              href={waConfirmUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center w-full rounded-lg bg-retail px-4 py-2.5 text-sm font-semibold text-white hover:bg-retail/90 transition-colors"
            >
              Send booking on WhatsApp
            </a>
          </div>
        </div>
      </div>
    )
  }

  /* ─── Step 1: pick a time ─── */
  if (step === "pick") {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">Book a Demo</h1>
          <p className="mt-3 text-lg text-muted-foreground">
            Pick a time that works for you — we&apos;ll meet on Google Meet.
          </p>
        </div>

        {loadingSlots ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : slotsError ? (
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-6 text-center space-y-3">
            <p className="text-sm text-destructive">{slotsError}</p>
            <Button variant="outline" size="sm" onClick={() => void loadSlots()}>
              <RefreshCw className="w-4 h-4 mr-1.5" /> Retry
            </Button>
          </div>
        ) : feed ? (
          <>
            <SlotPicker
              slots={feed.slots}
              timezone={tz}
              onTimezoneChange={setTz}
              timezoneOptions={[feed.timezone]}
              selectedSlot={selectedSlot}
              onSelect={setSelectedSlot}
              emptyMessage="No open times in the next two weeks — message us on WhatsApp and we'll find a slot."
            />
            {error && (
              <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive mt-6">
                {error}
              </div>
            )}
            <div className="flex items-center justify-between gap-3 flex-wrap rounded-lg border border-border bg-muted/30 p-4 mt-6">
              <div className="text-sm">
                {selectedSlot ? (
                  <>
                    <p className="font-medium">{fmtFull(selectedSlot)}</p>
                    <p className="text-xs text-muted-foreground">
                      {feed.durationMinutes} minutes · {tz}
                    </p>
                  </>
                ) : (
                  <p className="text-muted-foreground">Select a time to continue</p>
                )}
              </div>
              <Button onClick={() => setStep("details")} disabled={!selectedSlot}>
                Continue
              </Button>
            </div>
          </>
        ) : null}
      </div>
    )
  }

  /* ─── Step 2: contact details ─── */
  return (
    <div className="max-w-2xl mx-auto">
      <button
        type="button"
        onClick={() => setStep("pick")}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="w-4 h-4" /> Back to times
      </button>

      <div className="rounded-lg border border-retail/30 bg-retail/5 p-4 mb-8 text-sm">
        <span className="text-muted-foreground">Demo time:</span>{" "}
        <span className="font-medium">{selectedSlot ? fmtFull(selectedSlot) : ""}</span>{" "}
        <span className="text-muted-foreground">· {feed?.durationMinutes ?? 30} minutes · {tz}</span>
      </div>

      <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} className="space-y-6" noValidate>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Full Name *</label>
            <input
              {...register("fullName")}
              type="text"
              placeholder="John Doe"
              className="w-full rounded-lg border border-border bg-background px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
            />
            {errors.fullName && <p className="mt-1.5 text-sm text-destructive">{errors.fullName.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Business Name *</label>
            <input
              {...register("businessName")}
              type="text"
              placeholder="Your Business Ltd"
              className="w-full rounded-lg border border-border bg-background px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
            />
            {errors.businessName && <p className="mt-1.5 text-sm text-destructive">{errors.businessName.message}</p>}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Email *</label>
            <input
              {...register("email")}
              type="email"
              placeholder="you@business.com"
              className="w-full rounded-lg border border-border bg-background px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
            />
            {errors.email && <p className="mt-1.5 text-sm text-destructive">{errors.email.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Phone / WhatsApp *</label>
            <input
              {...register("phone")}
              type="tel"
              placeholder="+234 80x xxx xxxx"
              className="w-full rounded-lg border border-border bg-background px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
            />
            {errors.phone && <p className="mt-1.5 text-sm text-destructive">{errors.phone.message}</p>}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Business Type *</label>
            <select
              {...register("businessType")}
              className="w-full rounded-lg border border-border bg-background px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent appearance-none"
            >
              <option value="">Select business type</option>
              {businessTypeOptions.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            {errors.businessType && <p className="mt-1.5 text-sm text-destructive">{errors.businessType.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Product Interest *</label>
            <select
              {...register("productInterest")}
              className="w-full rounded-lg border border-border bg-background px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent appearance-none"
            >
              {productOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-2">Anything we should prepare? (Optional)</label>
          <textarea
            {...register("message")}
            rows={3}
            placeholder="e.g. I run 2 supermarket branches and need inventory sync..."
            className="w-full rounded-lg border border-border bg-background px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent resize-none"
          />
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        <CaptchaField ref={captchaRef} onChange={setCaptcha} className="flex justify-center" />

        <Button type="submit" size="lg" className="w-full" disabled={submitting || !selectedSlot}>
          {submitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Booking your demo...
            </>
          ) : (
            "Confirm Booking"
          )}
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          Calls may be recorded and transcribed for notes.
        </p>
      </form>
    </div>
  )
}
