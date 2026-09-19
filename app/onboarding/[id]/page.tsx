"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  Loader2,
  Check,
  Upload,
  AlertCircle,
  ShieldCheck,
  ClipboardCheck,
  Plus,
  X,
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

type FieldType =
  | "text" | "email" | "tel" | "number" | "date"
  | "select" | "multiselect" | "textarea" | "section"
  | "userlist" | "branchlist"

interface DeploymentField {
  key: string
  label: string
  type: FieldType
  options?: string[]
  required?: boolean
  helpText?: string
  placeholder?: string
}

interface UserRow {
  name: string
  email: string
  phone: string
  role: string
}

interface BranchRow {
  name: string
  address: string
  phone: string
}

const USER_ROLES = ["Manager", "Cashier", "Staff", "Accountant", "Owner"]

const DEPLOYMENT_FIELDS: DeploymentField[] = [
  // ─── Branding ───
  { key: "sectionBranding", label: "Branding", type: "section" },
  { key: "brandName", label: "Brand / store display name", type: "text", required: true, placeholder: "e.g. Ada's Supermart" },
  { key: "preferredSubdomain", label: "Preferred account / subdomain name", type: "text", placeholder: "e.g. adassupermart" },
  { key: "receiptFooter", label: "Receipt footer message", type: "text", placeholder: "e.g. Thank you for shopping with us!" },

  // ─── Business & Contact ───
  { key: "sectionBusiness", label: "Business & Contact", type: "section" },
  { key: "legalName", label: "Registered business / legal name", type: "text", placeholder: "As registered with CAC" },
  { key: "rcNumber", label: "Business registration number (RC / CAC)", type: "text" },
  { key: "storePhone", label: "Store phone number", type: "tel", required: true },
  { key: "storeEmail", label: "Store email address", type: "email" },
  { key: "address", label: "Store address", type: "textarea", required: true, placeholder: "Street, area, nearest landmark" },
  { key: "city", label: "City", type: "text", required: true },
  { key: "state", label: "State / Region", type: "text", required: true },
  { key: "country", label: "Country", type: "text", required: true },

  // ─── Users & Access ───
  { key: "sectionUsers", label: "Users & Access", type: "section", helpText: "Who should get a login? The primary admin is usually the owner or manager." },
  { key: "adminName", label: "Primary admin — full name", type: "text", required: true },
  { key: "adminEmail", label: "Primary admin — email", type: "email", required: true },
  { key: "adminPhone", label: "Primary admin — phone", type: "tel", required: true },
  { key: "additionalUsers", label: "Additional users", type: "userlist", helpText: "Add each staff member who needs a login — name, email, phone and role." },

  // ─── Branches ───
  { key: "sectionBranches", label: "Branches", type: "section", helpText: "Your head office is assumed to be the store address above unless listed here." },
  { key: "branchList", label: "Branch locations", type: "branchlist" },

  // ─── Banking & Tax ───
  { key: "sectionBanking", label: "Banking & Tax", type: "section" },
  { key: "bankName", label: "Bank name", type: "text" },
  { key: "accountName", label: "Account name", type: "text" },
  { key: "accountNumber", label: "Business account number", type: "text" },
  { key: "vatRegistered", label: "Are you registered for VAT / tax?", type: "select", options: ["Yes", "No"] },
  { key: "taxRate", label: "Tax rate to apply on sales (%)", type: "number", placeholder: "e.g. 7.5" },
  { key: "tin", label: "Tax Identification Number (TIN)", type: "text" },

  // ─── Online Payments ───
  { key: "sectionPayments", label: "Online Payments", type: "section" },
  { key: "paymentVendor", label: "Which online payment vendor should we connect?", type: "select", options: ["Paystack", "Flutterwave", "Monnify", "Bank transfer only", "None — advise me"], required: true },
  { key: "paymentAccountExists", label: "Do you already have an account with that vendor?", type: "select", options: ["Yes", "No", "Not yet — need help setting up"] },
  { key: "paymentPublicKey", label: "Vendor public key (optional)", type: "text", placeholder: "e.g. pk_live_...", helpText: "Paste your PUBLIC key only. Never share secret keys here — we will collect those securely during setup." },

  // ─── Shipping & Fulfilment ───
  { key: "sectionShipping", label: "Shipping & Fulfilment", type: "section" },
  { key: "shippingArrangement", label: "How do you handle deliveries?", type: "select", options: ["We deliver ourselves", "Third-party courier", "Customer pickup only", "Combination"], required: true },
  { key: "deliveryZones", label: "Delivery areas / zones covered", type: "textarea", placeholder: "e.g. Lekki, VI, Ikoyi — mainland on request" },
  { key: "deliveryFee", label: "Delivery fee structure", type: "text", placeholder: "e.g. Free within Lekki, ₦2,000 elsewhere" },

  // ─── Data, Hardware & Go-live ───
  { key: "sectionData", label: "Data, Hardware & Go-live", type: "section" },
  { key: "productData", label: "Do you have product data to import?", type: "select", options: ["Yes — CSV/Excel ready", "Yes — needs cleanup", "No — starting fresh"] },
  { key: "hardware", label: "What hardware do you have? (select all that apply)", type: "multiselect", options: ["Barcode scanner", "Receipt printer", "Cash drawer", "Customer display", "Tablet / iPad", "Computer", "Weighing scale", "Card terminal", "None yet"] },
  { key: "suppliers", label: "Key suppliers (names and contacts)", type: "textarea" },
  { key: "goLiveDate", label: "Preferred go-live date", type: "date", required: true },
  { key: "specialRequests", label: "Any special deployment or integration requests", type: "textarea" },
]

const COMPLIANCE_DOCS = [
  { key: "logo", label: "Business logo (PNG or JPG — max 2MB)", required: false },
]

const inputCls =
  "w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-retail/30"

export default function ClientOnboardingPage() {
  const params = useParams()
  const id = params.id as string

  const [record, setRecord] = useState<OnboardingRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const [responses, setResponses] = useState<Record<string, unknown>>({})
  const [documents, setDocuments] = useState<Record<string, { name: string; data: string }>>({})

  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const fields = DEPLOYMENT_FIELDS

  useEffect(() => {
    if (!id) return
    fetch(`/api/onboarding/client?id=${id}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.record) {
          setRecord(data.record)
          if (data.record.clientResponses) {
            setResponses(data.record.clientResponses)
          }
        } else {
          setError(data.error || "Record not found")
        }
      })
      .catch(() => setError("Failed to load onboarding record"))
      .finally(() => setLoading(false))
  }, [id])

  const update = (key: string, value: unknown) => {
    setResponses((prev) => ({ ...prev, [key]: value }))
  }

  const toggleMulti = (key: string, option: string) => {
    setResponses((prev) => {
      const current = Array.isArray(prev[key]) ? (prev[key] as string[]) : []
      return { ...prev, [key]: current.includes(option) ? current.filter((o) => o !== option) : [...current, option] }
    })
  }

  const userRows = (): UserRow[] =>
    Array.isArray(responses.additionalUsers) ? (responses.additionalUsers as UserRow[]) : []

  const setUserRows = (rows: UserRow[]) => update("additionalUsers", rows)

  const updateUserRow = (idx: number, patch: Partial<UserRow>) => {
    setUserRows(userRows().map((r, i) => (i === idx ? { ...r, ...patch } : r)))
  }

  const branchRows = (): BranchRow[] =>
    Array.isArray(responses.branchList) ? (responses.branchList as BranchRow[]) : []

  const setBranchRows = (rows: BranchRow[]) => update("branchList", rows)

  const updateBranchRow = (idx: number, patch: Partial<BranchRow>) => {
    setBranchRows(branchRows().map((r, i) => (i === idx ? { ...r, ...patch } : r)))
  }

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
    for (const q of fields) {
      if (q.type === "section" || !q.required) continue
      const v = responses[q.key]
      if (v === undefined || v === null || String(v).trim() === "") {
        return `Please answer: ${q.label}`
      }
      if (q.type === "email" && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(v))) {
        return `Please enter a valid email for: ${q.label}`
      }
    }
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

    // Merge with existing documents — replace prior uploads for the same field
    const uploadKeys = new Set(Object.keys(documents))
    const allDocs = [
      ...(record?.documents || []).filter((d) => !uploadKeys.has(d.name.split("-")[0])),
      ...docRecords,
    ]

    try {
      const res = await fetch("/api/onboarding/client", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          clientResponses: { ...responses, ...(documents.logo ? { logo: documents.logo.data } : {}) },
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

        {/* Deployment Questions */}
        <div className="rounded-xl border border-border bg-card p-6 md:p-8 space-y-6">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-retail" />
            <h2 className="text-lg font-semibold text-foreground">Deployment Information</h2>
          </div>
          {fields.map((field) => {
            if (field.type === "section") {
              return (
                <div key={field.key} className="pt-4 border-t border-border first:border-t-0 first:pt-0">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">{field.label}</h3>
                  {field.helpText && <p className="text-xs text-muted-foreground mt-1">{field.helpText}</p>}
                </div>
              )
            }
            return (
              <div key={field.key}>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  {field.label} {field.required && <span className="text-red-500">*</span>}
                </label>
                {field.helpText && <p className="text-xs text-muted-foreground mb-1.5">{field.helpText}</p>}

                {field.type === "textarea" ? (
                  <textarea
                    value={String(responses[field.key] ?? "")}
                    onChange={(e) => update(field.key, e.target.value)}
                    rows={3}
                    placeholder={field.placeholder}
                    className={`${inputCls} resize-none`}
                  />
                ) : field.type === "select" ? (
                  <select
                    value={String(responses[field.key] ?? "")}
                    onChange={(e) => update(field.key, e.target.value)}
                    className={inputCls}
                  >
                    <option value="">Select...</option>
                    {field.options?.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : field.type === "multiselect" ? (
                  <div className="rounded-lg border border-border bg-background px-4 py-3 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {field.options?.map((o) => {
                      const selected = Array.isArray(responses[field.key]) && (responses[field.key] as string[]).includes(o)
                      return (
                        <label key={o} className="flex items-center gap-2 text-sm cursor-pointer py-0.5">
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => toggleMulti(field.key, o)}
                            className="rounded border-input shrink-0"
                          />
                          <span>{o}</span>
                        </label>
                      )
                    })}
                  </div>
                ) : field.type === "userlist" ? (
                  <div className="space-y-2">
                    {userRows().map((row, i) => (
                      <div key={i} className="grid grid-cols-2 sm:grid-cols-[1fr_1fr_1fr_130px_28px] gap-2 items-center rounded-lg border border-border bg-muted/20 p-2">
                        <input
                          value={row.name}
                          onChange={(e) => updateUserRow(i, { name: e.target.value })}
                          placeholder="Full name"
                          className="rounded-md border border-input bg-background px-2.5 py-1.5 text-sm"
                        />
                        <input
                          value={row.email}
                          onChange={(e) => updateUserRow(i, { email: e.target.value })}
                          placeholder="Email"
                          type="email"
                          className="rounded-md border border-input bg-background px-2.5 py-1.5 text-sm"
                        />
                        <input
                          value={row.phone}
                          onChange={(e) => updateUserRow(i, { phone: e.target.value })}
                          placeholder="Phone"
                          type="tel"
                          className="rounded-md border border-input bg-background px-2.5 py-1.5 text-sm"
                        />
                        <select
                          value={row.role}
                          onChange={(e) => updateUserRow(i, { role: e.target.value })}
                          className="rounded-md border border-input bg-background px-2.5 py-1.5 text-sm"
                        >
                          <option value="">Role...</option>
                          {USER_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                        </select>
                        <button
                          type="button"
                          onClick={() => setUserRows(userRows().filter((_, j) => j !== i))}
                          className="text-muted-foreground hover:text-destructive justify-self-end"
                          title="Remove user"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => setUserRows([...userRows(), { name: "", email: "", phone: "", role: "Cashier" }])}
                      className="flex items-center gap-1.5 text-xs font-medium text-retail hover:underline"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add user
                    </button>
                  </div>
                ) : field.type === "branchlist" ? (
                  <div className="space-y-2">
                    {branchRows().map((row, i) => (
                      <div key={i} className="grid grid-cols-1 sm:grid-cols-[160px_1fr_140px_28px] gap-2 items-center rounded-lg border border-border bg-muted/20 p-2">
                        <input
                          value={row.name}
                          onChange={(e) => updateBranchRow(i, { name: e.target.value })}
                          placeholder="Branch name"
                          className="rounded-md border border-input bg-background px-2.5 py-1.5 text-sm"
                        />
                        <input
                          value={row.address}
                          onChange={(e) => updateBranchRow(i, { address: e.target.value })}
                          placeholder="Address"
                          className="rounded-md border border-input bg-background px-2.5 py-1.5 text-sm"
                        />
                        <input
                          value={row.phone}
                          onChange={(e) => updateBranchRow(i, { phone: e.target.value })}
                          placeholder="Phone"
                          type="tel"
                          className="rounded-md border border-input bg-background px-2.5 py-1.5 text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => setBranchRows(branchRows().filter((_, j) => j !== i))}
                          className="text-muted-foreground hover:text-destructive justify-self-end"
                          title="Remove branch"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => setBranchRows([...branchRows(), { name: "", address: "", phone: "" }])}
                      className="flex items-center gap-1.5 text-xs font-medium text-retail hover:underline"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add branch
                    </button>
                  </div>
                ) : (
                  <input
                    type={field.type}
                    value={String(responses[field.key] ?? "")}
                    onChange={(e) => update(field.key, e.target.value)}
                    placeholder={field.placeholder}
                    className={inputCls}
                  />
                )}
              </div>
            )
          })}
        </div>

        {/* Branding & Documents */}
        <div className="rounded-xl border border-border bg-card p-6 md:p-8 space-y-6">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-retail" />
            <h2 className="text-lg font-semibold text-foreground">Branding & Documents</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Upload your business logo and any supporting files that will help us configure your account correctly.
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
                  <Check className="w-4 h-4" />
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
