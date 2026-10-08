"use client"

import { useState, useEffect, useMemo } from "react"
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
import { getStoreSetupFields, type StoreSetupFieldType } from "@/lib/store-setup-templates"

interface OnboardingRecord {
  id: string
  leadId: string | null
  businessId: string | null
  fullName: string
  businessName: string
  email: string
  phone: string
  productInterest: string
  businessType: string
  status: string
  storeSetupTemplate: string | null
  clientResponses: Record<string, unknown>
  documents: Array<{ name: string; url: string; uploadedAt: string }>
  signatureUrl: string
}

type FieldType = StoreSetupFieldType

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

/** Drive upload result stored against the field key. */
interface UploadedFile {
  name: string
  link: string | null
  fileId: string
}

const USER_ROLES = ["Manager", "Cashier", "Staff", "Accountant", "Owner"]

const LOGO_DOC = { key: "logo", label: "Business logo (PNG or JPG — max 5MB)", required: false }

/** Field types that upload straight to Google Drive instead of storing inline. */
const DRIVE_FIELD_TYPES = new Set<FieldType>(["file"])

const inputCls =
  "w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm outline-none focus:ring-retail/30"

/** Compact input used inside the repeatable user / branch rows. */
const rowInput = "rounded-md border border-input bg-background px-2.5 py-1.5 text-sm"

export default function ClientOnboardingPage() {
  const params = useParams()
  const id = params.id as string

  const [record, setRecord] = useState<OnboardingRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const [responses, setResponses] = useState<Record<string, unknown>>({})
  const [documents, setDocuments] = useState<Record<string, { name: string; data: string }>>({})
  /** Drive uploads keyed by field key — populated by the file fields. */
  const [uploads, setUploads] = useState<Record<string, UploadedFile>>({})
  const [uploadingKey, setUploadingKey] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState("")

  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  // Store Setup template resolved from the business type on the record.
  const fields = useMemo(
    () => getStoreSetupFields(record?.storeSetupTemplate || record?.businessType || record?.productInterest || "retail"),
    [record?.storeSetupTemplate, record?.businessType, record?.productInterest]
  )

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

  /**
   * Upload a Store Setup file field into the client's Google Drive folder.
   * This page is public, so it calls the onboarding-scoped upload route (which
   * resolves the business from the record) rather than the admin endpoint.
   */
  const uploadToDrive = async (key: string, file: File | null) => {
    if (!file) return
    setUploadError("")

    setUploadingKey(key)
    try {
      const form = new FormData()
      form.append("onboardingId", String(id))
      form.append("file", file)
      const res = await fetch("/api/onboarding/upload", { method: "POST", body: form })
      const data = await res.json()
      if (data.success && data.uploaded?.[0]) {
        const first = data.uploaded[0] as { name: string; fileId: string; link?: string }
        setUploads((prev) => ({ ...prev, [key]: { name: first.name, fileId: first.fileId, link: first.link || null } }))
      } else if (res.status === 409) {
        // Not linked to a business/lead yet — keep the file with the submission
        // so the client is never blocked, and say so plainly.
        setUploadError("We will attach this file to your submission instead.")
        await handleFileChange(key, file)
      } else {
        setUploadError(data.error || `Could not upload ${file.name}`)
      }
    } catch {
      setUploadError(`Could not upload ${file.name}`)
    } finally {
      setUploadingKey(null)
    }
  }

  const validate = (): string | null => {
    for (const q of fields) {
      if (q.type === "section" || !q.required) continue
      // File fields are satisfied by a Drive upload OR an inline document.
      if (DRIVE_FIELD_TYPES.has(q.type)) {
        if (!uploads[q.key] && !documents[q.key]) return `Please upload: ${q.label}`
        continue
      }
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

    // Drive uploads are recorded as links (url = Drive webViewLink) so the ops
    // team can open them from the onboarding record.
    const driveRecords = Object.entries(uploads).map(([key, up]) => ({
      name: `${key}-${up.name}`,
      url: up.link || `https://drive.google.com/file/d/${up.fileId}/view`,
      uploadedAt: new Date().toISOString(),
    }))

    // Merge with existing documents — replace prior uploads for the same field
    const uploadKeys = new Set([...Object.keys(documents), ...Object.keys(uploads)])
    const allDocs = [
      ...(record?.documents || []).filter((d) => !uploadKeys.has(d.name.split("-")[0])),
      ...docRecords,
      ...driveRecords,
    ]

    try {
      const res = await fetch("/api/onboarding/client", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          clientResponses: {
            ...responses,
            // Record Drive links alongside answers for the deployment brief.
            ...(Object.keys(uploads).length > 0
              ? { driveUploads: Object.fromEntries(Object.entries(uploads).map(([k, v]) => [k, v.link || v.fileId])) }
              : {}),
            ...(documents.logo ? { logo: documents.logo.data } : {}),
          },
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
    <div className="min-h-screen bg-muted py-8 sm:py-12 px-4 overflow-x-hidden">
      <div className="max-w-2xl mx-auto space-y-6 sm:space-y-8 w-full min-w-0">
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
        <div className="rounded-xl border border-border bg-card p-5 sm:p-6 md:p-8 space-y-6">
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
                ) : field.type === "file" ? (
                  uploads[field.key] ? (
                    <div className="flex items-center gap-2 text-sm text-green-600">
                      <Check className="w-4 h-4" />
                      <span>Uploaded: {uploads[field.key].name}</span>
                    </div>
                  ) : uploadingKey === field.key ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Uploading {field.label}…</span>
                    </div>
                  ) : documents[field.key] ? (
                    <div className="flex items-center gap-2 text-sm text-retail">
                      <Check className="w-4 h-4" />
                      <span>{documents[field.key].name}</span>
                    </div>
                  ) : (
                    <label className="flex items-center justify-center gap-2 w-full rounded-lg border border-dashed border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground cursor-pointer hover:bg-muted/50 transition-colors">
                      <Upload className="w-4 h-4" />
                      Click to upload (max 15MB)
                      <input
                        type="file"
                        className="hidden"
                        onChange={(e) => uploadToDrive(field.key, e.target.files?.[0] || null)}
                      />
                    </label>
                  )
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
                      <div key={i} className="rounded-lg border border-border bg-muted/20 p-3 space-y-2 sm:grid sm:grid-cols-[1fr_1fr_1fr_130px_32px] sm:gap-2 sm:space-y-0 sm:items-center">
                        <input
                          value={row.name}
                          onChange={(e) => updateUserRow(i, { name: e.target.value })}
                          placeholder="Full name"
                          aria-label="Full name"
                          className={`${rowInput} w-full`}
                        />
                        <input
                          value={row.email}
                          onChange={(e) => updateUserRow(i, { email: e.target.value })}
                          placeholder="Email"
                          type="email"
                          aria-label="Email"
                          className={`${rowInput} w-full`}
                        />
                        <input
                          value={row.phone}
                          onChange={(e) => updateUserRow(i, { phone: e.target.value })}
                          placeholder="Phone"
                          type="tel"
                          aria-label="Phone"
                          className={`${rowInput} w-full`}
                        />
                        <select
                          value={row.role}
                          onChange={(e) => updateUserRow(i, { role: e.target.value })}
                          aria-label="Role"
                          className={`${rowInput} w-full`}
                        >
                          <option value="">Role...</option>
                          {USER_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                        </select>
                        <button
                          type="button"
                          onClick={() => setUserRows(userRows().filter((_, j) => j !== i))}
                          className="text-muted-foreground hover:text-destructive justify-self-end p-1 -m-1"
                          title="Remove user"
                          aria-label={`Remove ${row.name || "user"}`}
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
                      <div key={i} className="rounded-lg border border-border bg-muted/20 p-3 space-y-2 sm:grid sm:grid-cols-[160px_1fr_140px_32px] sm:gap-2 sm:space-y-0 sm:items-center">
                        <input
                          value={row.name}
                          onChange={(e) => updateBranchRow(i, { name: e.target.value })}
                          placeholder="Branch name"
                          aria-label="Branch name"
                          className={`${rowInput} w-full`}
                        />
                        <input
                          value={row.address}
                          onChange={(e) => updateBranchRow(i, { address: e.target.value })}
                          placeholder="Address"
                          aria-label="Branch address"
                          className={`${rowInput} w-full`}
                        />
                        <input
                          value={row.phone}
                          onChange={(e) => updateBranchRow(i, { phone: e.target.value })}
                          placeholder="Phone"
                          type="tel"
                          aria-label="Branch phone"
                          className={`${rowInput} w-full`}
                        />
                        <button
                          type="button"
                          onClick={() => setBranchRows(branchRows().filter((_, j) => j !== i))}
                          className="text-muted-foreground hover:text-destructive justify-self-end p-1 -m-1"
                          title="Remove branch"
                          aria-label={`Remove ${row.name || "branch"}`}
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
        <div className="rounded-xl border border-border bg-card p-5 sm:p-6 md:p-8 space-y-6">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-retail" />
            <h2 className="text-lg font-semibold text-foreground">Branding & Documents</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Upload your business logo and any supporting files that will help us configure your account correctly.
            Files are saved securely to your MartPoint Drive folder.
          </p>
          {uploadError && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">{uploadError}</div>
          )}
          {[LOGO_DOC].map((doc) => (
            <div key={doc.key}>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                {doc.label} {doc.required && <span className="text-red-500">*</span>}
              </label>
              {uploads[doc.key] ? (
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <Check className="w-4 h-4" />
                  <span>Uploaded: {uploads[doc.key].name}</span>
                </div>
              ) : uploadingKey === doc.key ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Uploading logo…</span>
                </div>
              ) : record?.documents?.find((d) => d.name.includes(doc.key)) ? (
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
                  Click to upload (JPG, PNG — max 5MB)
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp"
                    className="hidden"
                    onChange={(e) => uploadToDrive(doc.key, e.target.files?.[0] || null)}
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
