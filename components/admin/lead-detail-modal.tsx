"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  X,
  Mail,
  Phone,
  Building2,
  Calendar,
  Pencil,
  Trash2,
  Rocket,
  FileText,
  CheckCircle2,
  Loader2,
  MessageSquare,
  ClipboardList,
  ExternalLink,
  Copy,
  User,
  Tag,
  GitBranch,
  Users,
  ShoppingBag,
  Clock,
  Wallet,
  TrendingUp,
  Smartphone,
  Globe,
  ArrowUpRight,
} from "lucide-react"

export interface Lead {
  id: string
  fullName: string
  businessName: string
  email: string
  phone: string
  businessType: string
  productInterest: string
  branches: string
  staffSize: string
  challenge?: string
  message?: string
  source: string
  status: "New" | "Contacted" | "Qualified" | "Proposal" | "Won" | "Lost"
  assignedTo?: string
  notes?: string
  questionnaireToken?: string | null
  questionnaireStatus?: string
  questionnaireSentAt?: string | null
  questionnaireSubmittedAt?: string | null
  submittedAt: string
  updatedAt: string
}

export interface QuestionnaireField {
  name: string
  label: string
  type: string
  options?: string[]
  required?: boolean
  default?: string | number | boolean
  selected?: boolean
}

type Tab = "overview" | "edit" | "notes" | "questionnaire" | "actions"

const PIPELINE_STAGES: Lead["status"][] = ["New", "Contacted", "Qualified", "Proposal", "Won", "Lost"]

const STAGE_COLORS: Record<string, string> = {
  New: "bg-info",
  Contacted: "bg-warning",
  Qualified: "bg-retail",
  Proposal: "bg-proposal",
  Won: "bg-success",
  Lost: "bg-destructive",
}

const BUSINESS_TYPES = [
  "Supermarket", "Mini Mart", "Grocery Store", "Convenience Store", "Provision Store",
  "Restaurant", "Fast Food", "Bakery", "Cafe", "Pizza Shop", "Shawarma", "Juice Bar",
  "Pharmacy", "Medical Store", "Clinic", "Hospital", "Diagnostic Centre",
  "Fashion Store", "Boutique", "Shoe Store", "Cosmetics Store", "Perfume Shop",
  "Beauty & Salon", "Barbershop", "Jewellery Store",
  "Electronics Store", "Phone Shop", "Computer Store", "Gadget Store", "Appliance Store",
  "Hardware Store", "Paint Store", "Plumbing Store",
  "Agro Dealer", "Feed Store", "Auto Parts", "Tyre Shop",
  "Laundry", "Printing", "Tailoring",
  "Distributor", "Wholesaler", "Manufacturer",
  "Multi-Branch Retail", "Other",
]

const inputClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-retail/30 focus:border-retail"

const labelClass = "block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5"

interface LeadDetailModalProps {
  lead: Lead
  onClose: () => void
  onUpdateStatus: (id: string, status: Lead["status"]) => Promise<void>
  onSaveNotes: (id: string, notes: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onUpdateLead: (id: string, data: Record<string, unknown>) => Promise<Lead | null>
  onConvertToBusiness: (lead: Lead) => Promise<void>
  onCreateQuote: (lead: Lead) => void
  onOpenQuestionnaire: (lead: Lead) => Promise<void>
  onMarkQuestionnaireReviewed: (lead: Lead) => Promise<void>
}

export function LeadDetailModal({
  lead,
  onClose,
  onUpdateStatus,
  onSaveNotes,
  onDelete,
  onUpdateLead,
  onConvertToBusiness,
  onCreateQuote,
  onOpenQuestionnaire,
  onMarkQuestionnaireReviewed,
}: LeadDetailModalProps) {
  const [tab, setTab] = useState<Tab>("overview")
  const [noteDraft, setNoteDraft] = useState(lead.notes || "")
  const [savingNotes, setSavingNotes] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({
    fullName: lead.fullName,
    businessName: lead.businessName,
    email: lead.email,
    phone: lead.phone,
    businessType: lead.businessType,
    productInterest: lead.productInterest,
    branches: lead.branches,
    staffSize: lead.staffSize,
    challenge: lead.challenge || "",
    message: lead.message || "",
    source: lead.source,
    status: lead.status,
    notes: lead.notes || "",
  })
  const [converting, setConverting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [questionnaireLoading, setQuestionnaireLoading] = useState(false)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handler)
    document.body.style.overflow = "hidden"
    return () => {
      window.removeEventListener("keydown", handler)
      document.body.style.overflow = ""
    }
  }, [onClose])

  const handleSaveNotes = async () => {
    setSavingNotes(true)
    await onSaveNotes(lead.id, noteDraft)
    setSavingNotes(false)
  }

  const handleSaveEdit = async () => {
    setEditing(true)
    const updated = await onUpdateLead(lead.id, editForm)
    if (updated) {
      setEditForm({
        fullName: updated.fullName,
        businessName: updated.businessName,
        email: updated.email,
        phone: updated.phone,
        businessType: updated.businessType,
        productInterest: updated.productInterest,
        branches: updated.branches,
        staffSize: updated.staffSize,
        challenge: updated.challenge || "",
        message: updated.message || "",
        source: updated.source,
        status: updated.status,
        notes: updated.notes || "",
      })
    }
    setEditing(false)
  }

  const handleDelete = async () => {
    if (!confirm("Delete this lead permanently? This cannot be undone.")) return
    setDeleting(true)
    await onDelete(lead.id)
    setDeleting(false)
  }

  const handleConvert = async () => {
    setConverting(true)
    await onConvertToBusiness(lead)
    setConverting(false)
  }

  const handleQuestionnaire = async () => {
    setQuestionnaireLoading(true)
    await onOpenQuestionnaire(lead)
    setQuestionnaireLoading(false)
  }

  const handleReview = async () => {
    setQuestionnaireLoading(true)
    await onMarkQuestionnaireReviewed(lead)
    setQuestionnaireLoading(false)
  }

  const productLabel =
    lead.productInterest === "retail"
      ? "MartPoint Retail"
      : lead.productInterest === "erp"
      ? "MartPoint ERP"
      : "Not Sure"

  const { sourceLabel, sourcePartner } = formatSource(lead.source)

  const estimate = lead.source.includes("estimate") ? parseEstimate(lead.challenge) : null

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "overview", label: "Overview", icon: <User className="w-3.5 h-3.5" /> },
    { id: "edit", label: "Edit", icon: <Pencil className="w-3.5 h-3.5" /> },
    { id: "notes", label: "Notes", icon: <MessageSquare className="w-3.5 h-3.5" /> },
    { id: "questionnaire", label: "Questionnaire", icon: <ClipboardList className="w-3.5 h-3.5" /> },
    { id: "actions", label: "Actions", icon: <Rocket className="w-3.5 h-3.5" /> },
  ]

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-5xl max-h-[92vh] flex flex-col rounded-2xl border border-border bg-background shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ─── Header ─── */}
        <div className="shrink-0 border-b border-border bg-gradient-to-r from-background to-muted/40">
          <div className="px-6 pt-6 pb-4">
            {/* Top row: name + status + close */}
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="text-2xl font-bold tracking-tight text-foreground truncate">
                  {lead.fullName}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {lead.email}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span
                  className={`inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full text-white ${STAGE_COLORS[lead.status]}`}
                >
                  {lead.status}
                </span>
                <button
                  onClick={onClose}
                  className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  title="Close (Esc)"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          {/* Contact / source strip */}
          <div className="px-6 pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
              <span
                className="inline-flex items-center gap-1.5 self-start text-[11px] font-semibold uppercase tracking-wider px-3 py-1.5 rounded-full border border-border bg-background"
                title="Lead source"
              >
                {sourceIcon(lead.source)}
                {sourceLabel}
                {sourcePartner && (
                  <span className="ml-1 text-proposal">· {sourcePartner}</span>
                )}
              </span>

              <div className="h-px sm:h-4 sm:w-px bg-border sm:block" />

              <a
                href={`mailto:${lead.email}`}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-retail transition-colors"
              >
                <Mail className="w-3.5 h-3.5" />
                <span className="truncate">{lead.email}</span>
              </a>
              <a
                href={`tel:${lead.phone}`}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-retail transition-colors"
              >
                <Phone className="w-3.5 h-3.5" />
                <span className="truncate">{lead.phone}</span>
              </a>
              <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Calendar className="w-3.5 h-3.5" />
                <span>{new Date(lead.submittedAt).toLocaleDateString()}</span>
              </span>
            </div>
          </div>

          {/* ─── Tabs ─── */}
          <div className="flex items-center gap-1 px-6 overflow-x-auto border-t border-border/60">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  tab === t.id
                    ? "border-retail text-retail"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40"
                }`}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* ─── Body ─── */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* ─── Overview ─── */}
          {tab === "overview" && (
            <div className="space-y-6">
              {estimate && (
                <div className="rounded-xl border border-retail/20 bg-retail-soft/40 p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <Wallet className="w-4 h-4 text-retail" />
                    <p className="text-sm font-bold text-foreground">Cost Estimate</p>
                    <span className="ml-auto text-[10px] uppercase tracking-wider text-muted-foreground">From calculator</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="rounded-lg border border-retail/10 bg-background p-4">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Retail Recommendation</p>
                      <p className="text-sm font-semibold text-foreground">{estimate.retailPlan}</p>
                      <p className="text-xl font-extrabold text-retail mt-1">{estimate.retailRange}</p>
                    </div>
                    <div className="rounded-lg border border-erp/10 bg-background p-4">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">ERP Recommendation</p>
                      <p className="text-sm font-semibold text-foreground">{estimate.erpPlan}</p>
                      <p className="text-xl font-extrabold text-erp mt-1">{estimate.erpRange}</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <InfoCard icon={<Building2 className="w-4 h-4" />} label="Business Name" value={lead.businessName} />
                <InfoCard icon={<Tag className="w-4 h-4" />} label="Business Type" value={lead.businessType || "—"} />
                <InfoCard icon={<ShoppingBag className="w-4 h-4" />} label="Product Interest" value={productLabel} />
                <InfoCard icon={<GitBranch className="w-4 h-4" />} label="Branches" value={lead.branches} />
                <InfoCard icon={<Users className="w-4 h-4" />} label="Staff Size" value={lead.staffSize} />
                <InfoCard icon={<Calendar className="w-4 h-4" />} label="Submitted" value={new Date(lead.submittedAt).toLocaleString()} />
              </div>

              {lead.challenge && !estimate && (
                <div>
                  <p className={labelClass}>Challenge / Pain Point</p>
                  <div className="rounded-lg border border-border bg-muted/20 p-4 text-sm text-foreground leading-relaxed">
                    {lead.challenge}
                  </div>
                </div>
              )}
              {lead.message && (
                <div>
                  <p className={labelClass}>Message</p>
                  <div className="rounded-lg border border-border bg-muted/20 p-4 text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                    {lead.message}
                  </div>
                </div>
              )}
              {lead.notes && (
                <div>
                  <p className={labelClass}>Existing Notes</p>
                  <div className="rounded-lg border border-border bg-muted/20 p-4 text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                    {lead.notes}
                  </div>
                </div>
              )}

              {/* Pipeline status selector */}
              <div>
                <p className={labelClass}>Pipeline Status</p>
                <div className="flex flex-wrap gap-2">
                  {PIPELINE_STAGES.map((s) => (
                    <button
                      key={s}
                      onClick={() => onUpdateStatus(lead.id, s)}
                      className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-all ${
                        lead.status === s
                          ? `${STAGE_COLORS[s]} text-white border-transparent shadow-sm`
                          : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ─── Edit ─── */}
          {tab === "edit" && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Full Name *</label>
                  <input
                    type="text"
                    value={editForm.fullName}
                    onChange={(e) => setEditForm((p) => ({ ...p, fullName: e.target.value }))}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Business Name *</label>
                  <input
                    type="text"
                    value={editForm.businessName}
                    onChange={(e) => setEditForm((p) => ({ ...p, businessName: e.target.value }))}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Email *</label>
                  <input
                    type="email"
                    value={editForm.email}
                    onChange={(e) => setEditForm((p) => ({ ...p, email: e.target.value }))}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Phone *</label>
                  <input
                    type="tel"
                    value={editForm.phone}
                    onChange={(e) => setEditForm((p) => ({ ...p, phone: e.target.value }))}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Business Type *</label>
                  <select
                    value={editForm.businessType}
                    onChange={(e) => setEditForm((p) => ({ ...p, businessType: e.target.value }))}
                    className={inputClass}
                  >
                    <option value="">Select...</option>
                    {BUSINESS_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Product Interest *</label>
                  <select
                    value={editForm.productInterest}
                    onChange={(e) => setEditForm((p) => ({ ...p, productInterest: e.target.value }))}
                    className={inputClass}
                  >
                    <option value="retail">MartPoint Retail</option>
                    <option value="erp">MartPoint ERP</option>
                    <option value="not-sure">Not Sure — Need Guidance</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Branches *</label>
                  <select
                    value={editForm.branches}
                    onChange={(e) => setEditForm((p) => ({ ...p, branches: e.target.value }))}
                    className={inputClass}
                  >
                    <option value="1">1</option>
                    <option value="2-3">2-3</option>
                    <option value="4-6">4-6</option>
                    <option value="7-10">7-10</option>
                    <option value="10+">10+</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Staff Size *</label>
                  <select
                    value={editForm.staffSize}
                    onChange={(e) => setEditForm((p) => ({ ...p, staffSize: e.target.value }))}
                    className={inputClass}
                  >
                    <option value="1-5">1-5</option>
                    <option value="6-15">6-15</option>
                    <option value="16-30">16-30</option>
                    <option value="31-50">31-50</option>
                    <option value="50+">50+</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Source *</label>
                  <select
                    value={editForm.source}
                    onChange={(e) => setEditForm((p) => ({ ...p, source: e.target.value }))}
                    className={inputClass}
                  >
                    <option value="manual">Manual Entry</option>
                    <option value="website">Website</option>
                    <option value="whatsapp">WhatsApp</option>
                    <option value="referral">Referral</option>
                    <option value="social-media">Social Media</option>
                    <option value="cold-call">Cold Call</option>
                    <option value="email">Email</option>
                    <option value="event">Event</option>
                    <option value="estimate-calculator">Estimate Calculator</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Status</label>
                  <select
                    value={editForm.status}
                    onChange={(e) => setEditForm((p) => ({ ...p, status: e.target.value as Lead["status"] }))}
                    className={inputClass}
                  >
                    {PIPELINE_STAGES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className={labelClass}>Challenge / Pain Point</label>
                <input
                  type="text"
                  value={editForm.challenge}
                  onChange={(e) => setEditForm((p) => ({ ...p, challenge: e.target.value }))}
                  className={inputClass}
                  placeholder="What problem are they trying to solve?"
                />
              </div>
              <div>
                <label className={labelClass}>Message</label>
                <textarea
                  rows={3}
                  value={editForm.message}
                  onChange={(e) => setEditForm((p) => ({ ...p, message: e.target.value }))}
                  className={`${inputClass} resize-none`}
                  placeholder="Additional context from the lead..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-2 border-t border-border">
                <Button variant="outline" size="sm" onClick={() => setTab("overview")} disabled={editing}>
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSaveEdit} disabled={editing}>
                  {editing ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <CheckCircle2 className="w-4 h-4 mr-1.5" />}
                  Save Changes
                </Button>
              </div>
            </div>
          )}

          {/* ─── Notes ─── */}
          {tab === "notes" && (
            <div className="space-y-4">
              <div>
                <label className={labelClass}>Internal Notes</label>
                <textarea
                  rows={10}
                  value={noteDraft}
                  onChange={(e) => setNoteDraft(e.target.value)}
                  className={`${inputClass} resize-y`}
                  placeholder="Add internal notes about this lead — call summaries, next steps, context for the team..."
                />
              </div>
              <div className="flex justify-end">
                <Button size="sm" onClick={handleSaveNotes} disabled={savingNotes}>
                  {savingNotes ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <CheckCircle2 className="w-4 h-4 mr-1.5" />}
                  Save Notes
                </Button>
              </div>
              {lead.notes && (
                <div>
                  <p className={labelClass}>Previous Notes (saved in DB)</p>
                  <div className="rounded-lg border border-border bg-muted/20 p-4 text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                    {lead.notes}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ─── Questionnaire ─── */}
          {tab === "questionnaire" && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-lg border border-border bg-muted/20 p-4">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Status</p>
                  <p className="text-sm font-semibold">{lead.questionnaireStatus || "Not Sent"}</p>
                </div>
                <div className="rounded-lg border border-border bg-muted/20 p-4">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Sent At</p>
                  <p className="text-sm font-semibold">
                    {lead.questionnaireSentAt ? new Date(lead.questionnaireSentAt).toLocaleString() : "—"}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-muted/20 p-4">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Submitted At</p>
                  <p className="text-sm font-semibold">
                    {lead.questionnaireSubmittedAt ? new Date(lead.questionnaireSubmittedAt).toLocaleString() : "—"}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-muted/20 p-4">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Token</p>
                  <p className="text-sm font-mono truncate" title={lead.questionnaireToken || ""}>
                    {lead.questionnaireToken ? lead.questionnaireToken.slice(0, 12) + "…" : "—"}
                  </p>
                </div>
              </div>

              {lead.questionnaireToken && (
                <div className="rounded-lg border border-border bg-muted/20 p-4">
                  <p className="text-xs font-semibold text-muted-foreground mb-2">Questionnaire Link</p>
                  <div className="flex items-center gap-2">
                    <input
                      readOnly
                      value={`${typeof window !== "undefined" ? window.location.origin : ""}/questionnaire/${lead.questionnaireToken}`}
                      className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-xs font-mono"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const url = `${window.location.origin}/questionnaire/${lead.questionnaireToken}`
                        navigator.clipboard.writeText(url)
                      }}
                    >
                      <Copy className="w-3.5 h-3.5 mr-1" />
                      Copy
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => window.open(`/questionnaire/${lead.questionnaireToken}`, "_blank")}
                    >
                      <ExternalLink className="w-3.5 h-3.5 mr-1" />
                      Open
                    </Button>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-3 pt-2 border-t border-border">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleQuestionnaire}
                  disabled={questionnaireLoading}
                >
                  {questionnaireLoading ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <ClipboardList className="w-4 h-4 mr-1.5" />}
                  {lead.questionnaireToken ? "Resend Questionnaire" : "Send Questionnaire"}
                </Button>
                {lead.questionnaireStatus === "Submitted" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleReview}
                    disabled={questionnaireLoading}
                  >
                    <CheckCircle2 className="w-4 h-4 mr-1.5" />
                    Mark Reviewed
                  </Button>
                )}
                {(lead.questionnaireStatus === "Submitted" || lead.questionnaireStatus === "Reviewed") && (
                  <Button
                    size="sm"
                    variant="retail"
                    onClick={() => onCreateQuote(lead)}
                  >
                    <FileText className="w-4 h-4 mr-1.5" />
                    Create Quote
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* ─── Actions ─── */}
          {tab === "actions" && (
            <div className="space-y-4">
              {lead.status === "Won" && (
                <ActionCard
                  icon={<Rocket className="w-5 h-5 text-retail" />}
                  title="Convert to Business"
                  description="Create a full business record from this lead and start onboarding."
                  buttonText="Convert Now"
                  onClick={handleConvert}
                  loading={converting}
                  accent="retail"
                />
              )}

              <ActionCard
                icon={<FileText className="w-5 h-5 text-proposal" />}
                title="Create Quote"
                description={
                  lead.questionnaireStatus === "Submitted" || lead.questionnaireStatus === "Reviewed"
                    ? "Generate a formal quotation for this lead."
                    : "A questionnaire must be submitted before creating a quote. Send one from the Questionnaire tab."
                }
                buttonText="Create Quote"
                onClick={() => onCreateQuote(lead)}
                disabled={lead.questionnaireStatus !== "Submitted" && lead.questionnaireStatus !== "Reviewed"}
                accent="proposal"
              />

              <ActionCard
                icon={<Mail className="w-5 h-5 text-info" />}
                title="Email Lead"
                description={`Send an email directly to ${lead.email}.`}
                buttonText="Compose"
                onClick={() => (window.location.href = `mailto:${lead.email}`)}
                accent="info"
              />

              <ActionCard
                icon={<Phone className="w-5 h-5 text-success" />}
                title="Call Lead"
                description={`Call ${lead.fullName} at ${lead.phone}.`}
                buttonText="Call"
                onClick={() => (window.location.href = `tel:${lead.phone}`)}
                accent="success"
              />

              <div className="pt-4 border-t border-border">
                <ActionCard
                  icon={<Trash2 className="w-5 h-5 text-destructive" />}
                  title="Delete Lead"
                  description="Permanently remove this lead. This action cannot be undone."
                  buttonText="Delete"
                  onClick={handleDelete}
                  loading={deleting}
                  accent="destructive"
                />
              </div>
            </div>
          )}
        </div>

        {/* ─── Footer ─── */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-muted/30 shrink-0">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="w-3.5 h-3.5" />
            <span>Last updated:</span>
            <span className="font-medium">{new Date(lead.updatedAt || lead.submittedAt).toLocaleDateString()}</span>
          </div>
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  )
}

/* ─── Sub-components & helpers ─── */

function InfoCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-muted/10 p-4 hover:bg-muted/20 transition-colors">
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-muted-foreground">{icon}</span>
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</p>
      </div>
      <p className="text-sm font-semibold text-foreground break-words">{value}</p>
    </div>
  )
}

function ActionCard({
  icon,
  title,
  description,
  buttonText,
  onClick,
  loading,
  disabled,
  accent,
}: {
  icon: React.ReactNode
  title: string
  description: string
  buttonText: string
  onClick: () => void
  loading?: boolean
  disabled?: boolean
  accent: "retail" | "erp" | "proposal" | "info" | "success" | "destructive"
}) {
  const btnVariant = accent === "destructive" ? "outline" : accent === "retail" ? "retail" : "outline"
  const btnClass = accent === "destructive" ? "border-destructive/30 text-destructive hover:bg-destructive/5" : ""

  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-border bg-muted/10 p-4 hover:bg-muted/20 transition-colors">
      <div className="flex items-start gap-3 min-w-0">
        <div className="shrink-0 mt-0.5 p-2 rounded-lg bg-background border border-border/50">{icon}</div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        </div>
      </div>
      <Button
        size="sm"
        variant={btnVariant}
        onClick={onClick}
        disabled={disabled || loading}
        className={`shrink-0 ${btnClass}`}
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
        {buttonText}
      </Button>
    </div>
  )
}

function formatSource(source: string): { sourceLabel: string; sourcePartner?: string } {
  if (!source) return { sourceLabel: "Unknown" }

  if (source.startsWith("estimate-calculator:partner:")) {
    const partner = source.split(":partner:")[1]
    return { sourceLabel: "Estimate Calculator", sourcePartner: partner }
  }
  if (source === "estimate-calculator") {
    return { sourceLabel: "Estimate Calculator" }
  }
  if (source.startsWith("partner:")) {
    return { sourceLabel: "Partner Referral", sourcePartner: source.split(":partner:")[1] }
  }

  const map: Record<string, string> = {
    website: "Website",
    whatsapp: "WhatsApp",
    referral: "Referral",
    "social-media": "Social Media",
    "cold-call": "Cold Call",
    email: "Email",
    event: "Event",
    manual: "Manual Entry",
  }
  return { sourceLabel: map[source] || source.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()) }
}

function sourceIcon(source: string): React.ReactNode {
  if (source.includes("estimate")) return <Wallet className="w-3 h-3" />
  if (source.includes("partner")) return <TrendingUp className="w-3 h-3" />
  if (source === "whatsapp") return <Smartphone className="w-3 h-3" />
  if (source === "website") return <Globe className="w-3 h-3" />
  if (source === "email") return <Mail className="w-3 h-3" />
  return <ArrowUpRight className="w-3 h-3" />
}

function parseEstimate(challenge?: string): { retailPlan: string; retailRange: string; erpPlan: string; erpRange: string } | null {
  if (!challenge || !challenge.startsWith("Estimate —")) return null
  try {
    const body = challenge.replace("Estimate —", "").trim()
    const retailMatch = body.match(/Retail:\s*([^()]+)\s*\(([^)]+)\)/)
    const erpMatch = body.match(/ERP:\s*([^()]+)\s*\(([^)]+)\)/)
    if (!retailMatch || !erpMatch) return null
    return {
      retailPlan: retailMatch[1].trim(),
      retailRange: retailMatch[2].trim(),
      erpPlan: erpMatch[1].trim(),
      erpRange: erpMatch[2].trim(),
    }
  } catch {
    return null
  }
}
