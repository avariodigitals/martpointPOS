"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  Loader2,
  Check,
  Upload,
  FileText,
  AlertCircle,
  ShieldCheck,
  ClipboardCheck,
} from "lucide-react"

interface OnboardingRecord {
  id: string
  fullName: string
  businessName: string
  email: string
  phone: string
  productInterest: string
  status: string
  clientResponses: Record<string, unknown>
  documents: Array<{ name: string; url: string; uploadedAt: string }>
  signatureUrl: string
}

const RETAIL_QUESTIONS = [
  { key: "businessName", label: "Registered business name", type: "text", required: true },
  { key: "cacNumber", label: "CAC registration number (if applicable)", type: "text", required: false },
  { key: "businessAddress", label: "Business address", type: "textarea", required: true },
  { key: "ownerName", label: "Owner / Director full name", type: "text", required: true },
  { key: "ownerPhone", label: "Owner / Director phone number", type: "text", required: true },
  { key: "staffCount", label: "How many staff will use the system?", type: "text", required: true },
  { key: "devices", label: "What devices will you use? (Android tablet, iPad, computer, phone)", type: "textarea", required: true },
  { key: "barcodePrinter", label: "Do you have a barcode scanner and receipt printer?", type: "text", required: true },
  { key: "goLiveDate", label: "Preferred go-live date", type: "text", required: true },
  { key: "storeType", label: "What type of store do you run?", type: "text", required: true },
  { key: "creditSales", label: "Do you sell on credit to customers?", type: "text", required: true },
  { key: "weighingScale", label: "Do you need weighing scale integration?", type: "text", required: true },
  { key: "expiryTracking", label: "Do you track expiry dates on products?", type: "text", required: true },
  { key: "currentStockMethod", label: "How do you currently manage stock?", type: "textarea", required: true },
]

const ERP_QUESTIONS = [
  { key: "businessName", label: "Registered business name", type: "text", required: true },
  { key: "cacNumber", label: "CAC registration number (if applicable)", type: "text", required: false },
  { key: "businessAddress", label: "Business address and branch locations", type: "textarea", required: true },
  { key: "ownerName", label: "Owner / Director full name and phone number", type: "text", required: true },
  { key: "staffCount", label: "How many staff will use the system?", type: "text", required: true },
  { key: "devices", label: "What devices will you use? (Android tablet, iPad, computer, phone)", type: "textarea", required: true },
  { key: "barcodePrinter", label: "Do you have a barcode scanner and receipt printer?", type: "text", required: true },
  { key: "goLiveDate", label: "Preferred go-live date", type: "text", required: true },
  { key: "warehouseCount", label: "How many warehouses or godowns do you operate?", type: "text", required: true },
  { key: "creditToDealers", label: "Do you sell on credit to dealers?", type: "text", required: true },
  { key: "multiBranchTransfer", label: "Do you need multi-branch transfer tracking?", type: "text", required: true },
  { key: "keySuppliers", label: "Who are your key suppliers?", type: "textarea", required: true },
  { key: "apiAccess", label: "Do you need API access to other systems?", type: "text", required: true },
]

const COMPLIANCE_DOCS = [
  { key: "idCard", label: "Valid ID Card (Driver's Licence, Passport, Voter's Card, or National ID)", required: true },
  { key: "cacCertificate", label: "CAC Registration Certificate (if business is registered)", required: false },
  { key: "utilityBill", label: "Utility Bill (not older than 3 months) for address verification", required: true },
  { key: "passportPhoto", label: "Passport photograph of business owner / director", required: true },
]

export default function ClientOnboardingPage() {
  const params = useParams()
  const id = params.id as string

  const [record, setRecord] = useState<OnboardingRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const [responses, setResponses] = useState<Record<string, string>>({})
  const [documents, setDocuments] = useState<Record<string, { name: string; data: string }>>({})
  const [signatureName, setSignatureName] = useState("")
  const [agreed, setAgreed] = useState(false)

  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const questions = record?.productInterest === "erp" ? ERP_QUESTIONS : RETAIL_QUESTIONS

  useEffect(() => {
    if (!id) return
    fetch(`/api/onboarding/client?id=${id}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.record) {
          setRecord(data.record)
          // Pre-fill existing responses
          if (data.record.clientResponses) {
            const existing: Record<string, string> = {}
            Object.entries(data.record.clientResponses).forEach(([k, v]) => {
              existing[k] = String(v)
            })
            setResponses(existing)
          }
          if (data.record.signatureUrl) {
            setSignatureName(data.record.signatureUrl.replace("signed-by:", ""))
          }
        } else {
          setError(data.error || "Record not found")
        }
      })
      .catch(() => setError("Failed to load onboarding record"))
      .finally(() => setLoading(false))
  }, [id])

  const handleFileChange = async (key: string, file: File | null) => {
    if (!file) return
    const maxSize = 2 * 1024 * 1024 // 2MB
    if (file.size > maxSize) {
      alert("File must be under 2MB")
      return
    }
    const reader = new FileReader()
    reader.onloadend = () => {
      const data = reader.result as string
      setDocuments((prev) => ({ ...prev, [key]: { name: file.name, data } }))
    }
    reader.readAsDataURL(file)
  }

  const validate = (): string | null => {
    for (const q of questions) {
      if (q.required && !responses[q.key]?.trim()) {
        return `Please answer: ${q.label}`
      }
    }
    for (const doc of COMPLIANCE_DOCS) {
      if (doc.required && !documents[doc.key] && !record?.documents?.find((d) => d.name.includes(doc.key))) {
        return `Please upload: ${doc.label}`
      }
    }
    if (!signatureName.trim()) return "Please type your full name as a digital signature"
    if (!agreed) return "Please confirm the accuracy of your information"
    return null
  }

  const handleSubmit = async () => {
    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }

    setSubmitting(true)
    setError("")

    // Build document records
    const docRecords = Object.entries(documents).map(([key, doc]) => ({
      name: `${key}-${doc.name}`,
      url: doc.data,
      uploadedAt: new Date().toISOString(),
    }))

    // Merge with existing documents
    const allDocs = [...(record?.documents || []), ...docRecords]

    try {
      const res = await fetch("/api/onboarding/client", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          clientResponses: responses,
          signatureName,
          documents: allDocs,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setSubmitted(true)
      } else {
        setError(data.error || "Submission failed")
      }
    } catch {
      setError("Failed to submit. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error && !record) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted p-4">
        <div className="max-w-md w-full rounded-xl border border-border bg-card p-8 text-center">
          <AlertCircle className="w-10 h-10 text-destructive mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-foreground mb-2">Onboarding Not Found</h2>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </div>
    )
  }

  if (submitted || record?.status === "Completed") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted p-4">
        <div className="max-w-md w-full rounded-xl border border-border bg-card p-8 text-center">
          <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
            <Check className="w-7 h-7 text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">Onboarding Submitted</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Thank you, {record?.fullName}. We have received your setup information and compliance documents. Our team will review everything and contact you within 24 hours to schedule your system setup.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-muted py-12 px-4">
      <div className="max-w-2xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="w-12 h-12 rounded-xl bg-retail-soft flex items-center justify-center mx-auto mb-4">
            <ClipboardCheck className="w-6 h-6 text-retail" />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Complete Your MartPoint Setup</h1>
          <p className="mt-2 text-muted-foreground">
            Hi {record?.fullName}, please answer a few questions and upload the required documents so we can configure your system correctly.
          </p>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Setup Questions */}
        <div className="rounded-xl border border-border bg-card p-6 md:p-8 space-y-6">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-retail" />
            <h2 className="text-lg font-semibold text-foreground">Setup Questions</h2>
          </div>
          {questions.map((q) => (
            <div key={q.key}>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                {q.label} {q.required && <span className="text-red-500">*</span>}
              </label>
              {q.type === "textarea" ? (
                <textarea
                  value={responses[q.key] || ""}
                  onChange={(e) => setResponses((prev) => ({ ...prev, [q.key]: e.target.value }))}
                  rows={3}
                  className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-retail/30 resize-none"
                />
              ) : (
                <input
                  type="text"
                  value={responses[q.key] || ""}
                  onChange={(e) => setResponses((prev) => ({ ...prev, [q.key]: e.target.value }))}
                  className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-retail/30"
                />
              )}
            </div>
          ))}
        </div>

        {/* Compliance Documents */}
        <div className="rounded-xl border border-border bg-card p-6 md:p-8 space-y-6">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-retail" />
            <h2 className="text-lg font-semibold text-foreground">Compliance Documents</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            We are required by law to verify the identity of every business we onboard. Please upload the following documents. All information is stored securely and used only for compliance purposes.
          </p>
          {COMPLIANCE_DOCS.map((doc) => (
            <div key={doc.key}>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                {doc.label} {doc.required && <span className="text-red-500">*</span>}
              </label>
              {record?.documents?.find((d) => d.name.includes(doc.key)) ? (
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <Check className="w-4 h-4" />
                  <span>Already uploaded</span>
                </div>
              ) : documents[doc.key] ? (
                <div className="flex items-center gap-2 text-sm text-retail">
                  <FileText className="w-4 h-4" />
                  <span>{documents[doc.key].name}</span>
                </div>
              ) : (
                <label className="flex items-center justify-center gap-2 w-full rounded-lg border border-dashed border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground cursor-pointer hover:bg-muted/50 transition-colors">
                  <Upload className="w-4 h-4" />
                  Click to upload (JPG, PNG, PDF — max 2MB)
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png,.pdf"
                    className="hidden"
                    onChange={(e) => handleFileChange(doc.key, e.target.files?.[0] || null)}
                  />
                </label>
              )}
            </div>
          ))}
        </div>

        {/* Digital Signature & Agreement */}
        <div className="rounded-xl border border-border bg-card p-6 md:p-8 space-y-6">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-retail" />
            <h2 className="text-lg font-semibold text-foreground">Declaration & Signature</h2>
          </div>
          <div className="rounded-lg bg-muted/30 p-4 text-sm text-muted-foreground space-y-2">
            <p>I hereby declare that:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>All information provided above is true, accurate and complete to the best of my knowledge.</li>
              <li>The documents uploaded are genuine and belong to the business named above.</li>
              <li>I am authorised to act on behalf of this business.</li>
              <li>I understand that providing false information may result in termination of service.</li>
              <li>MartPoint may verify my identity and business registration with relevant authorities.</li>
            </ul>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Type your full name as digital signature <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={signatureName}
              onChange={(e) => setSignatureName(e.target.value)}
              placeholder="e.g. Adebayo Olumide"
              className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-retail/30"
            />
          </div>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-1 w-4 h-4 rounded border-border text-retail focus:ring-retail"
            />
            <span className="text-sm text-muted-foreground">
              I confirm that all the information and documents provided are accurate and I agree to the terms above.
            </span>
          </label>
        </div>

        {/* Submit */}
        <Button
          size="lg"
          variant="retail"
          className="w-full"
          onClick={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Submitting...
            </>
          ) : (
            <>
              <Check className="mr-2 h-4 w-4" />
              Submit Onboarding
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
