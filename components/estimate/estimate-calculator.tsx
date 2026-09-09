"use client"

import { useMemo, useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import {
  ArrowLeft,
  ArrowRight,
  Calculator,
  Check,
  CheckCircle2,
  Loader2,
  MessageCircle,
  Store,
  Sparkles,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { allIndustries } from "@/lib/industries"
import { COUNTRIES } from "@/lib/locations"
import { CaptchaField, type CaptchaState, type CaptchaFieldHandle } from "@/components/captcha-field"
import {
  BRANCH_OPTIONS,
  STAFF_OPTIONS,
  PRODUCT_COUNT_OPTIONS,
  PRODUCT_SERVICE_OPTIONS,
  YES_NO_MAYBE,
  HARDWARE_OPTIONS,
  TRAINING_OPTIONS,
  buildEstimate,
  buildEstimateWhatsAppMessage,
  formatRange,
  type EstimateAnswers,
  type EstimateContact,
  type EstimatePricing,
  type EstimateResult,
} from "@/lib/estimate-calculator"

const WHATSAPP_NUMBER = "+2348036028069"

const STEPS = ["Business", "Scale", "Requirements", "Estimate", "Contact"] as const

const businessTypes = [...allIndustries.map((i) => i.name), "Other"]
const countryOptions = COUNTRIES.map((c) => c.name)

interface EstimateCalculatorProps {
  pricing: EstimatePricing
  partnerCode?: string
}

const emptyAnswers: EstimateAnswers = {
  businessName: "",
  businessType: "",
  country: "Nigeria",
  branches: "",
  staffSize: "",
  productCount: "",
  productOrService: "",
  onlineStore: "",
  hardwareAvailable: "",
  receiptHardware: "",
  dataMigration: "",
  offlineOperation: "",
  erpModules: "",
  trainingPreference: "",
}

export function EstimateCalculator({ pricing, partnerCode }: EstimateCalculatorProps) {
  const [step, setStep] = useState(0)
  const [direction, setDirection] = useState(1)
  const [answers, setAnswers] = useState<EstimateAnswers>(emptyAnswers)
  const [contact, setContact] = useState<EstimateContact>({ fullName: "", email: "", phone: "", notes: "" })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const [captcha, setCaptcha] = useState<CaptchaState>({ configured: false, token: null })
  const captchaRef = useRef<CaptchaFieldHandle>(null)

  const result: EstimateResult = useMemo(() => buildEstimate(answers, pricing), [answers, pricing])

  const update = <K extends keyof EstimateAnswers>(key: K, value: EstimateAnswers[K]) =>
    setAnswers((a) => ({ ...a, [key]: value }))

  const go = (delta: number) => {
    setDirection(delta)
    setStep((s) => Math.max(0, Math.min(STEPS.length - 1, s + delta)))
  }

  const canProceed = (() => {
    switch (step) {
      case 0:
        return answers.businessType && answers.country.trim() !== ""
      case 1:
        return answers.branches && answers.staffSize && answers.productCount && answers.productOrService
      case 2:
        return (
          answers.onlineStore &&
          answers.offlineOperation &&
          answers.erpModules &&
          answers.hardwareAvailable &&
          answers.trainingPreference
        )
      case 3:
        return true
      case 4:
        return (
          contact.fullName.trim().length >= 2 &&
          /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email) &&
          contact.phone.trim().length >= 7
        )
      default:
        return true
    }
  })()

  const onSubmit = async () => {
    setSubmitting(true)
    setError("")
    const captchaToken = (await captchaRef.current?.execute()) ?? null
    if (captcha.configured && !captchaToken) {
      setSubmitting(false)
      setError("Please complete the security check before submitting.")
      return
    }
    try {
      const res = await fetch("/api/estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...answers,
          ...contact,
          partnerCode: partnerCode || undefined,
          captchaToken: captchaToken || undefined,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error || "Failed to submit. Please try again.")
      }
      setSubmitted(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  /* ─── Success screen ─── */
  if (submitted) {
    const waMessage = buildEstimateWhatsAppMessage(answers, contact, result)
    const waUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(waMessage)}`
    return (
      <div className="max-w-2xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-success/20 bg-card p-8 md:p-12 text-center shadow-sm"
        >
          <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-5">
            <CheckCircle2 className="w-8 h-8 text-success" />
          </div>
          <h2 className="text-2xl md:text-3xl font-bold text-foreground">Your estimate is in</h2>
          <p className="mt-3 text-muted-foreground leading-relaxed max-w-md mx-auto">
            We have received your requirements and logged them with our sales team. A MartPoint
            advisor will review your estimate and reach out shortly.
          </p>

          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4 text-left">
            <RecSummaryCard rec={result.retail} icon={<Store className="w-5 h-5 text-retail" />} />
            <RecSummaryCard rec={result.erp} icon={<Sparkles className="w-5 h-5 text-erp" />} />
          </div>

          <div className="mt-8 rounded-xl border border-retail/20 bg-retail-soft p-5">
            <p className="text-sm font-semibold text-foreground mb-1">Want a faster response?</p>
            <p className="text-xs text-muted-foreground mb-4">
              Share your requirement with us on WhatsApp now — we usually reply within minutes.
            </p>
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 w-full rounded-lg bg-retail px-4 py-3 text-sm font-semibold text-white hover:bg-retail/90 transition-colors"
            >
              <MessageCircle className="w-4 h-4" />
              Share my requirement on WhatsApp
            </a>
          </div>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Progress */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Step {step + 1} of {STEPS.length}
          </span>
          <span className="text-xs text-muted-foreground">{STEPS[step]}</span>
        </div>
        <div className="h-2 w-full rounded-full bg-border overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-retail"
            initial={false}
            animate={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          />
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="p-6 md:p-10">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={step}
              custom={direction}
              initial={{ opacity: 0, x: direction > 0 ? 40 : -40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: direction > 0 ? -40 : 40 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
            >
              {/* STEP 0 — Business profile */}
              {step === 0 && (
                <StepWrapper
                  title="Tell us about your business"
                  subtitle="A few details so we can tailor the right MartPoint edition for you."
                >
                  <Field label="Business name (optional)">
                    <input
                      type="text"
                      value={answers.businessName}
                      onChange={(e) => update("businessName", e.target.value)}
                      placeholder="e.g. Blessing Stores Ltd"
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Business type *">
                    <select
                      value={answers.businessType}
                      onChange={(e) => update("businessType", e.target.value)}
                      className={inputClass}
                    >
                      <option value="">Select business type</option>
                      {businessTypes.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Country *">
                    <select
                      value={answers.country}
                      onChange={(e) => update("country", e.target.value)}
                      className={inputClass}
                    >
                      <option value="">Select country</option>
                      {countryOptions.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </Field>
                </StepWrapper>
              )}

              {/* STEP 1 — Scale */}
              {step === 1 && (
                <StepWrapper
                  title="How big is your operation?"
                  subtitle="This helps us size your plan and estimate add-on branches."
                >
                  <ChoiceGroup
                    label="Number of branches *"
                    options={BRANCH_OPTIONS}
                    value={answers.branches}
                    onChange={(v) => update("branches", v)}
                  />
                  <ChoiceGroup
                    label="Number of staff / users *"
                    options={STAFF_OPTIONS}
                    value={answers.staffSize}
                    onChange={(v) => update("staffSize", v)}
                  />
                  <ChoiceGroup
                    label="Approximate product / item count *"
                    options={PRODUCT_COUNT_OPTIONS}
                    value={answers.productCount}
                    onChange={(v) => update("productCount", v)}
                  />
                  <ChoiceGroup
                    label="Do you sell products, services, or both? *"
                    options={PRODUCT_SERVICE_OPTIONS}
                    value={answers.productOrService}
                    onChange={(v) => update("productOrService", v)}
                  />
                </StepWrapper>
              )}

              {/* STEP 2 — Requirements */}
              {step === 2 && (
                <StepWrapper
                  title="What do you need from your system?"
                  subtitle="These answers shape whether Retail Cloud, Retail Offline, or ERP fits best."
                >
                  <ChoiceGroup
                    label="Do you need an online store?"
                    options={YES_NO_MAYBE}
                    value={answers.onlineStore}
                    onChange={(v) => update("onlineStore", v)}
                  />
                  <ChoiceGroup
                    label="Do you need to work without internet (offline)?"
                    options={YES_NO_MAYBE}
                    value={answers.offlineOperation}
                    onChange={(v) => update("offlineOperation", v)}
                  />
                  <ChoiceGroup
                    label="Do you need ERP modules (accounting, HR, procurement)?"
                    options={YES_NO_MAYBE}
                    value={answers.erpModules}
                    onChange={(v) => update("erpModules", v)}
                  />
                  <ChoiceGroup
                    label="Do you already have hardware (POS, computer, tablet)?"
                    options={HARDWARE_OPTIONS}
                    value={answers.hardwareAvailable}
                    onChange={(v) => update("hardwareAvailable", v)}
                  />
                  <ChoiceGroup
                    label="Training preference *"
                    options={TRAINING_OPTIONS}
                    value={answers.trainingPreference}
                    onChange={(v) => update("trainingPreference", v)}
                  />
                </StepWrapper>
              )}

              {/* STEP 3 — Estimate */}
              {step === 3 && (
                <StepWrapper
                  title="Your estimated cost range"
                  subtitle="Based on your answers, here are the MartPoint editions we'd recommend. Final pricing is confirmed after a quick conversation."
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <RecommendationCard
                      rec={result.retail}
                      icon={<Store className="w-5 h-5 text-retail" />}
                      accent="retail"
                    />
                    <RecommendationCard
                      rec={result.erp}
                      icon={<Sparkles className="w-5 h-5 text-erp" />}
                      accent="erp"
                    />
                  </div>
                  <div className="mt-6 rounded-xl border border-border bg-muted/60 p-4">
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      <strong className="text-foreground">Good to know:</strong> Implementation,
                      onsite training, and custom workflows are assessed separately and quoted
                      before any work begins. These estimates exclude hardware unless stated.
                    </p>
                  </div>
                </StepWrapper>
              )}

              {/* STEP 4 — Contact */}
              {step === 4 && (
                <StepWrapper
                  title="Where should we send your estimate?"
                  subtitle="We'll log your requirement with our team and follow up with a tailored proposal."
                >
                  <Field label="Full name *">
                    <input
                      type="text"
                      value={contact.fullName}
                      onChange={(e) => setContact((c) => ({ ...c, fullName: e.target.value }))}
                      placeholder="John Doe"
                      className={inputClass}
                    />
                  </Field>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <Field label="Email *">
                      <input
                        type="email"
                        value={contact.email}
                        onChange={(e) => setContact((c) => ({ ...c, email: e.target.value }))}
                        placeholder="you@business.com"
                        className={inputClass}
                      />
                    </Field>
                    <Field label="Phone *">
                      <input
                        type="tel"
                        value={contact.phone}
                        onChange={(e) => setContact((c) => ({ ...c, phone: e.target.value }))}
                        placeholder="+234 80x xxx xxxx"
                        className={inputClass}
                      />
                    </Field>
                  </div>
                  <Field label="Anything else? (optional)">
                    <textarea
                      rows={3}
                      value={contact.notes}
                      onChange={(e) => setContact((c) => ({ ...c, notes: e.target.value }))}
                      placeholder="Special workflows, timelines, integrations…"
                      className={cn(inputClass, "resize-none")}
                    />
                  </Field>
                  {partnerCode && (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
                      Referred by partner <span className="font-mono font-semibold">{partnerCode}</span> — your estimate will be linked to them.
                    </div>
                  )}
                  <CaptchaField ref={captchaRef} onChange={setCaptcha} className="flex justify-center" />
                </StepWrapper>
              )}
            </motion.div>
          </AnimatePresence>

          {error && (
            <div className="mt-6 rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
              {error}
            </div>
          )}

          {/* Nav buttons */}
          <div className="mt-8 flex items-center justify-between gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => go(-1)}
              disabled={step === 0 || submitting}
              className={cn(step === 0 && "invisible")}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>

            {step < STEPS.length - 1 ? (
              <Button type="button" onClick={() => go(1)} disabled={!canProceed}>
                Continue
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button type="button" onClick={onSubmit} disabled={!canProceed || submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting…
                  </>
                ) : (
                  <>
                    <Calculator className="mr-2 h-4 w-4" />
                    Submit my estimate
                  </>
                )}
              </Button>
            )}
          </div>

          {!canProceed && step < STEPS.length - 1 && (
            <p className="mt-3 text-xs text-muted-foreground text-right">
              Please complete the required fields to continue.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

/* ─── Sub-components ─── */

const inputClass =
  "w-full rounded-lg border border-border bg-background px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-retail/30 focus:border-retail"

function StepWrapper({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: React.ReactNode
}) {
  return (
    <div>
      <h2 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">{title}</h2>
      <p className="mt-2 text-sm text-muted-foreground leading-relaxed mb-6">{subtitle}</p>
      <div className="space-y-5">{children}</div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-foreground mb-2">{label}</label>
      {children}
    </div>
  )
}

function ChoiceGroup({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: { value: string; label: string }[]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-foreground mb-2">{label}</label>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        {options.map((o) => {
          const active = value === o.value
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => onChange(o.value)}
              className={cn(
                "relative rounded-lg border px-3 py-2.5 text-sm font-medium text-left transition-all",
                active
                  ? "border-retail bg-retail-soft text-foreground ring-2 ring-retail/20"
                  : "border-border bg-background text-foreground hover:border-muted-foreground/40 hover:bg-muted/50",
              )}
            >
              {active && (
                <span className="absolute top-2 right-2">
                  <Check className="w-3.5 h-3.5 text-retail" />
                </span>
              )}
              {o.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function RecommendationCard({
  rec,
  icon,
  accent,
}: {
  rec: EstimateResult["retail"]
  icon: React.ReactNode
  accent: "retail" | "erp"
}) {
  const accentText = accent === "retail" ? "text-retail" : "text-erp"
  const accentSoft = accent === "retail" ? "bg-retail-soft" : "bg-erp-soft"
  const accentBorder = accent === "retail" ? "border-retail/30" : "border-erp/30"
  return (
    <div className={cn("rounded-xl border bg-card p-5 flex flex-col", accentBorder)}>
      <div className="flex items-center gap-2 mb-3">
        <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center", accentSoft)}>
          {icon}
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {accent === "retail" ? "Retail" : "Enterprise"}
          </p>
          <p className="text-sm font-bold text-foreground leading-tight">{rec.planName}</p>
        </div>
      </div>
      <p className={cn("text-2xl font-extrabold", accentText)}>{formatRange(rec)}</p>
      <ul className="mt-4 space-y-2 flex-1">
        {rec.inclusions.map((inc) => (
          <li key={inc} className="flex items-start gap-2 text-sm text-foreground">
            <Check className={cn("w-4 h-4 mt-0.5 shrink-0", accentText)} />
            {inc}
          </li>
        ))}
      </ul>
      <p className="mt-4 text-xs text-muted-foreground leading-relaxed">{rec.rationale}</p>
    </div>
  )
}

function RecSummaryCard({
  rec,
  icon,
}: {
  rec: EstimateResult["retail"]
  icon: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-border bg-muted/40 p-4">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <p className="text-sm font-bold text-foreground">{rec.planName}</p>
      </div>
      <p className="text-lg font-extrabold text-foreground">{formatRange(rec)}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {rec.inclusions.slice(0, 3).map((inc) => (
          <span
            key={inc}
            className="inline-block rounded-full bg-background border border-border px-2 py-0.5 text-xs text-muted-foreground"
          >
            {inc}
          </span>
        ))}
      </div>
    </div>
  )
}
