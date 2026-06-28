"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { CheckCircle, Loader2 } from "lucide-react"
import { allIndustries } from "@/lib/industries"

const leadSchema = z.object({
  fullName: z.string().min(2, "Full name is required"),
  businessName: z.string().min(2, "Business name is required"),
  email: z.string().email("Valid email is required"),
  phone: z.string().min(10, "Valid phone number is required"),
  businessType: z.string().min(1, "Business type is required"),
  productInterest: z.string().min(1, "Product interest is required"),
  branches: z.string().min(1, "Number of branches is required"),
  staffSize: z.string().min(1, "Staff size is required"),
  challenge: z.string().optional(),
  message: z.string().optional(),
})

type LeadFormData = z.infer<typeof leadSchema>

interface LeadFormProps {
  pageType: "demo" | "quote" | "contact"
  productDefault?: "retail" | "erp" | "not-sure"
}

const businessTypes = [
  ...allIndustries.map((i) => i.name),
  "Other",
]

const productOptions = [
  { value: "retail", label: "MartPoint Retail" },
  { value: "erp", label: "MartPoint ERP" },
  { value: "not-sure", label: "Not Sure — Need Guidance" },
]

const branchOptions = ["1", "2-3", "4-6", "7-10", "10+"]
const staffOptions = ["1-5", "6-15", "16-30", "31-50", "50+"]

export function LeadForm({ pageType, productDefault = "not-sure" }: LeadFormProps) {
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LeadFormData>({
    resolver: zodResolver(leadSchema),
    defaultValues: {
      productInterest: productDefault,
    },
  })

  const buildWhatsAppMessage = (data: LeadFormData) => {
    const lines = [
      "Hi, I came across your website and filled out the contact form. Here's my info:",
      "",
      `Name: ${data.fullName}`,
      `Business: ${data.businessName}`,
      `Email: ${data.email}`,
      `Phone: ${data.phone}`,
      `Business Type: ${data.businessType}`,
      `Product Interest: ${productOptions.find(o => o.value === data.productInterest)?.label ?? data.productInterest}`,
      `Branches: ${data.branches}`,
      `Staff Size: ${data.staffSize}`,
    ]
    if (data.challenge) lines.push(`Challenge: ${data.challenge}`)
    if (data.message) lines.push(`Message: ${data.message}`)
    lines.push("", "Can we talk?")
    return lines.join("\n")
  }

  const onSubmit = async (data: LeadFormData) => {
    setSubmitting(true)
    setError("")

    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          source: pageType,
          submittedAt: new Date().toISOString(),
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to submit. Please try again.")
      }

      // Open WhatsApp with pre-filled message
      const message = buildWhatsAppMessage(data)
      const waUrl = `https://wa.me/+2348036028069?text=${encodeURIComponent(message)}`
      window.open(waUrl, "_blank")

      setSubmitted(true)
    } catch {
      setError("Something went wrong. Please try again or contact us directly.")
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    const waUrl = `https://wa.me/+2348036028069?text=${encodeURIComponent(
      "Hi, I just submitted the contact form on your website. I'm ready to talk about MartPoint. Can we start now?"
    )}`
    return (
      <div className="rounded-2xl border border-success/20 bg-success/5 p-10 text-center">
        <div className="w-14 h-14 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-7 h-7 text-success" />
        </div>
        <h3 className="text-2xl font-bold text-foreground mb-2">
          Thank you!
        </h3>
        <p className="text-muted-foreground leading-relaxed max-w-md mx-auto mb-6">
          {pageType === "demo"
            ? "We have received your demo request. Our team will contact you within 24 hours to schedule a time."
            : pageType === "quote"
            ? "We have received your quote request. Our team will review your requirements and respond within 24 hours."
            : "We have received your message. Our sales team will contact you within 24 hours."}
        </p>
        <div className="rounded-xl border border-retail/20 bg-retail-soft p-5 max-w-sm mx-auto">
          <p className="text-sm font-semibold text-foreground mb-2">
            Want a faster response?
          </p>
          <p className="text-xs text-muted-foreground mb-3">
            Message us on WhatsApp now — we reply within minutes.
          </p>
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center w-full rounded-lg bg-retail px-4 py-2.5 text-sm font-semibold text-white hover:bg-retail/90 transition-colors"
          >
            Continue on WhatsApp
          </a>
        </div>
      </div>
    )
  }

  const headline =
    pageType === "demo"
      ? "Book a Demo"
      : pageType === "quote"
      ? "Request a Quote"
      : "Talk to Sales"

  const subtitle =
    pageType === "demo"
      ? "See MartPoint in action with a personalized walkthrough."
      : pageType === "quote"
      ? "Tell us about your business and we will send a custom quote."
      : "Send us a message and we will get back to you."

  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-10">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
          {headline}
        </h1>
        <p className="mt-3 text-lg text-muted-foreground">{subtitle}</p>
      </div>

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-6"
        noValidate
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Full Name *
            </label>
            <input
              {...register("fullName")}
              type="text"
              placeholder="John Doe"
              className="w-full rounded-lg border border-border bg-background px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
            />
            {errors.fullName && (
              <p className="mt-1.5 text-sm text-destructive">
                {errors.fullName.message}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Business Name *
            </label>
            <input
              {...register("businessName")}
              type="text"
              placeholder="Your Business Ltd"
              className="w-full rounded-lg border border-border bg-background px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
            />
            {errors.businessName && (
              <p className="mt-1.5 text-sm text-destructive">
                {errors.businessName.message}
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Email *
            </label>
            <input
              {...register("email")}
              type="email"
              placeholder="you@business.com"
              className="w-full rounded-lg border border-border bg-background px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
            />
            {errors.email && (
              <p className="mt-1.5 text-sm text-destructive">
                {errors.email.message}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Phone Number *
            </label>
            <input
              {...register("phone")}
              type="tel"
              placeholder="+234 80x xxx xxxx"
              className="w-full rounded-lg border border-border bg-background px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
            />
            {errors.phone && (
              <p className="mt-1.5 text-sm text-destructive">
                {errors.phone.message}
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Business Type *
            </label>
            <select
              {...register("businessType")}
              className="w-full rounded-lg border border-border bg-background px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent appearance-none"
            >
              <option value="">Select business type</option>
              {businessTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            {errors.businessType && (
              <p className="mt-1.5 text-sm text-destructive">
                {errors.businessType.message}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Product Interest *
            </label>
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
            {errors.productInterest && (
              <p className="mt-1.5 text-sm text-destructive">
                {errors.productInterest.message}
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Number of Branches *
            </label>
            <select
              {...register("branches")}
              className="w-full rounded-lg border border-border bg-background px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent appearance-none"
            >
              <option value="">Select branches</option>
              {branchOptions.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
            {errors.branches && (
              <p className="mt-1.5 text-sm text-destructive">
                {errors.branches.message}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Estimated Staff Size *
            </label>
            <select
              {...register("staffSize")}
              className="w-full rounded-lg border border-border bg-background px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent appearance-none"
            >
              <option value="">Select staff size</option>
              {staffOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            {errors.staffSize && (
              <p className="mt-1.5 text-sm text-destructive">
                {errors.staffSize.message}
              </p>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Current Challenge (Optional)
          </label>
          <input
            {...register("challenge")}
            type="text"
            placeholder="What problem are you trying to solve?"
            className="w-full rounded-lg border border-border bg-background px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Message (Optional)
          </label>
          <textarea
            {...register("message")}
            rows={4}
            placeholder="Any additional details..."
            className="w-full rounded-lg border border-border bg-background px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent resize-none"
          />
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        <Button
          type="submit"
          size="lg"
          className="w-full"
          disabled={submitting}
        >
          {submitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Submitting...
            </>
          ) : (
            <>
              {pageType === "demo"
                ? "Book My Demo"
                : pageType === "quote"
                ? "Request My Quote"
                : "Send Message"}
            </>
          )}
        </Button>
      </form>
    </div>
  )
}
