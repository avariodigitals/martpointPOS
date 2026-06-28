"use client"

import { useState, useRef, type FormEvent } from "react"
import { Button } from "@/components/ui/button"
import { Mail, Upload, Check, Loader2, AlertCircle } from "lucide-react"

interface FormData {
  fullName: string
  email: string
  phone: string
  linkedin: string
  cvFile: File | null
}

interface FormErrors {
  fullName?: string
  email?: string
  phone?: string
  linkedin?: string
  cvFile?: string
}

export function CareersApplicationForm() {
  const [form, setForm] = useState<FormData>({
    fullName: "",
    email: "",
    phone: "",
    linkedin: "",
    cvFile: null,
  })
  const [errors, setErrors] = useState<FormErrors>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState("")

  const validate = (): boolean => {
    const newErrors: FormErrors = {}
    if (!form.fullName.trim()) newErrors.fullName = "Full name is required"
    if (!form.email.trim()) {
      newErrors.email = "Email is required"
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      newErrors.email = "Please enter a valid email address"
    }
    if (!form.phone.trim()) {
      newErrors.phone = "Phone number is required"
    } else if (form.phone.trim().length < 7) {
      newErrors.phone = "Please enter a valid phone number"
    }
    if (!form.linkedin.trim()) {
      newErrors.linkedin = "LinkedIn profile is required"
    } else if (!form.linkedin.includes("linkedin.com")) {
      newErrors.linkedin = "Please enter a valid LinkedIn URL"
    }
    if (!form.cvFile) newErrors.cvFile = "Please upload your CV"
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null
    if (file) {
      const maxSize = 5 * 1024 * 1024 // 5MB
      if (file.size > maxSize) {
        setErrors((prev) => ({ ...prev, cvFile: "File must be under 5MB" }))
        setFileName("")
        setForm((prev) => ({ ...prev, cvFile: null }))
        return
      }
      const allowedTypes = [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ]
      if (!allowedTypes.includes(file.type)) {
        setErrors((prev) => ({ ...prev, cvFile: "Only PDF or Word documents accepted" }))
        setFileName("")
        setForm((prev) => ({ ...prev, cvFile: null }))
        return
      }
      setErrors((prev) => ({ ...prev, cvFile: undefined }))
      setFileName(file.name)
      setForm((prev) => ({ ...prev, cvFile: file }))
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitError("")
    if (!validate()) return

    setSubmitting(true)
    try {
      const payload = new FormData()
      payload.append("fullName", form.fullName)
      payload.append("email", form.email)
      payload.append("phone", form.phone)
      payload.append("linkedin", form.linkedin)
      if (form.cvFile) payload.append("cv", form.cvFile)

      const res = await fetch("/api/careers", {
        method: "POST",
        body: payload,
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        throw new Error(data.error || "Submission failed")
      }
      setSubmitted(true)
      setForm({ fullName: "", email: "", phone: "", linkedin: "", cvFile: null })
      setFileName("")
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Something went wrong. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center max-w-lg mx-auto">
        <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
          <Check className="w-7 h-7 text-green-600" />
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-2">Application Submitted</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Thank you for your interest in joining MartPoint. We have received your CV and details. Our team will review your application and contact you within one week if there is a match.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-lg mx-auto space-y-5">
      {submitError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{submitError}</p>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-foreground mb-1.5">
          Full Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={form.fullName}
          onChange={(e) => setForm((prev) => ({ ...prev, fullName: e.target.value }))}
          placeholder="e.g. John Doe"
          className={`w-full rounded-lg border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-retail/30 ${errors.fullName ? "border-red-300" : "border-border"}`}
        />
        {errors.fullName && <p className="text-xs text-red-500 mt-1">{errors.fullName}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-1.5">
          Email Address <span className="text-red-500">*</span>
        </label>
        <input
          type="email"
          value={form.email}
          onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
          placeholder="john@example.com"
          className={`w-full rounded-lg border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-retail/30 ${errors.email ? "border-red-300" : "border-border"}`}
        />
        {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-1.5">
          Phone Number <span className="text-red-500">*</span>
        </label>
        <input
          type="tel"
          value={form.phone}
          onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
          placeholder="+234 803 602 8069"
          className={`w-full rounded-lg border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-retail/30 ${errors.phone ? "border-red-300" : "border-border"}`}
        />
        {errors.phone && <p className="text-xs text-red-500 mt-1">{errors.phone}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-1.5">
          LinkedIn Profile <span className="text-red-500">*</span>
        </label>
        <input
          type="url"
          value={form.linkedin}
          onChange={(e) => setForm((prev) => ({ ...prev, linkedin: e.target.value }))}
          placeholder="https://linkedin.com/in/yourprofile"
          className={`w-full rounded-lg border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-retail/30 ${errors.linkedin ? "border-red-300" : "border-border"}`}
        />
        {errors.linkedin && <p className="text-xs text-red-500 mt-1">{errors.linkedin}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-1.5">
          Upload CV <span className="text-red-500">*</span>
        </label>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.doc,.docx"
          onChange={handleFileChange}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className={`w-full rounded-lg border border-dashed px-4 py-3 text-sm flex items-center justify-center gap-2 transition-colors ${errors.cvFile ? "border-red-300 bg-red-50 text-red-600" : fileName ? "border-retail bg-retail-soft text-retail" : "border-border bg-muted/30 text-muted-foreground hover:bg-muted/50"}`}
        >
          <Upload className="w-4 h-4" />
          {fileName || "Click to upload PDF or Word document (max 5MB)"}
        </button>
        {errors.cvFile && <p className="text-xs text-red-500 mt-1">{errors.cvFile}</p>}
      </div>

      <Button
        type="submit"
        size="lg"
        variant="retail"
        className="w-full"
        disabled={submitting}
      >
        {submitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Sending Application...
          </>
        ) : (
          <>
            <Mail className="mr-2 h-4 w-4" />
            Submit Application
          </>
        )}
      </Button>
    </form>
  )
}
