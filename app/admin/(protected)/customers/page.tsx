"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Loader2,
  Users,
  Star,
  MessageSquare,
  CheckCircle2,
  AlertCircle,
  Send,
  Copy,
  Check,
  Smile,
  Meh,
  Frown,
  ThumbsUp,
  Clock,
  ChevronDown,
  ChevronUp,
} from "lucide-react"

interface Ticket {
  id: string
  type: "complaint" | "resolution"
  note: string
  createdAt: string
}

type CheckItem = { done: boolean; remarks: string }

type Customer = {
  id: string
  fullName: string
  businessName: string
  email: string
  phone: string
  businessType: string
  productInterest: string
  relationship: "pleased" | "neutral" | "unhappy"
  testimonial: string
  feedbackToken: string
  tickets: Ticket[]
  checks: Record<string, CheckItem>
  feedback: Record<string, unknown>
  submittedAt: string
  updatedAt: string
}

const STEPS = ["deployment", "configuration", "testing", "training", "handover"]

const RELATIONSHIP_OPTIONS: { value: Customer["relationship"]; label: string; color: string; icon: React.ElementType }[] = [
  { value: "pleased", label: "Pleased", color: "text-green-700 bg-green-50 border-green-200", icon: Smile },
  { value: "neutral", label: "Neutral", color: "text-amber-700 bg-amber-50 border-amber-200", icon: Meh },
  { value: "unhappy", label: "Unhappy", color: "text-red-700 bg-red-50 border-red-200", icon: Frown },
]

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

function StarRating({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={`w-4 h-4 ${n <= Math.round(value) ? "text-amber-500 fill-amber-500" : "text-gray-300"}`}
        />
      ))}
    </div>
  )
}

export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState("")

  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<"checklist" | "tickets" | "testimonial" | "feedback">("checklist")

  const [draftChecks, setDraftChecks] = useState<Record<string, CheckItem>>({})
  const [draftTestimonial, setDraftTestimonial] = useState("")
  const [draftRelationship, setDraftRelationship] = useState<Customer["relationship"]>("neutral")
  const [ticketType, setTicketType] = useState<"complaint" | "resolution">("complaint")
  const [ticketNote, setTicketNote] = useState("")
  const [savingId, setSavingId] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch("/api/admin/customers")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data.customers) setCustomers(data.customers)
      })
      .catch(() => {
        if (!cancelled) setMessage("Failed to load customers")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  const counts = useMemo(() => {
    const total = customers.length
    const pleased = customers.filter((c) => c.relationship === "pleased").length
    const unhappy = customers.filter((c) => c.relationship === "unhappy").length
    const withFeedback = customers.filter((c) => Object.keys(c.feedback).length > 0).length
    return { total, pleased, unhappy, withFeedback }
  }, [customers])

  const expand = (customer: Customer) => {
    if (expandedId === customer.id) {
      setExpandedId(null)
      return
    }
    setExpandedId(customer.id)
    setActiveTab("checklist")
    setDraftChecks({ ...customer.checks })
    setDraftTestimonial(customer.testimonial || "")
    setDraftRelationship(customer.relationship || "neutral")
    setTicketType("complaint")
    setTicketNote("")
  }

  const saveCustomer = async (id: string, payload: Partial<Customer>) => {
    setSavingId(id)
    setMessage("")
    try {
      const res = await fetch("/api/admin/customers", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...payload }),
      })
      const data = await res.json()
      if (data.success && data.customer) {
        setCustomers((prev) =>
          prev.map((c) => (c.id === id ? { ...c, ...payload, updatedAt: data.customer.updated_at } : c))
        )
        setMessage("Saved.")
        setTimeout(() => setMessage(""), 2000)
      } else {
        setMessage(data.error || "Failed to save")
      }
    } catch {
      setMessage("Failed to save")
    } finally {
      setSavingId(null)
    }
  }

  const copyLink = (token: string, id: string) => {
    const link = `${window.location.origin}/f/${token}`
    navigator.clipboard.writeText(link)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const addTicket = (customer: Customer) => {
    if (!ticketNote.trim()) return
    const newTicket: Ticket = {
      id: crypto.randomUUID(),
      type: ticketType,
      note: ticketNote.trim(),
      createdAt: new Date().toISOString(),
    }
    saveCustomer(customer.id, { tickets: [newTicket, ...customer.tickets] })
    setTicketNote("")
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Users className="w-5 h-5" />
            Customers
          </h2>
          <p className="text-muted-foreground">Won leads only. Track delivery, complaints, testimonials and mood.</p>
        </div>
      </div>

      {message && (
        <p className={`text-sm ${message.includes("Saved") ? "text-green-600" : "text-red-500"}`}>{message}</p>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Customers</p>
            <p className="text-2xl font-bold">{counts.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Pleased</p>
            <p className="text-2xl font-bold text-green-600">{counts.pleased}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Unhappy</p>
            <p className="text-2xl font-bold text-red-600">{counts.unhappy}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Feedback In</p>
            <p className="text-2xl font-bold text-blue-600">{counts.withFeedback}</p>
          </CardContent>
        </Card>
      </div>

      {/* Customer list */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Users className="w-4 h-4" />
            Customer List
          </CardTitle>
        </CardHeader>
        <CardContent>
          {customers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="w-10 h-10 mx-auto mb-3" />
              <p className="text-sm">No won leads yet. Convert a lead first.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {customers.map((customer) => {
                const isExpanded = expandedId === customer.id
                const rel = RELATIONSHIP_OPTIONS.find((r) => r.value === customer.relationship)
                const RelIcon = rel?.icon || Meh
                return (
                  <div
                    key={customer.id}
                    className="rounded-lg border border-border bg-muted/20 overflow-hidden"
                  >
                    <div
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 cursor-pointer hover:bg-muted/40 transition-colors"
                      onClick={() => expand(customer)}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold">{customer.fullName}</p>
                          <span
                            className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border font-medium ${rel?.color || ""}`}
                          >
                            <RelIcon className="w-3 h-3" />
                            {rel?.label}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {customer.businessName || "No business name"} · {customer.productInterest === "erp" ? "ERP" : "Retail"}
                        </p>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          <span>{customer.email}</span>
                          <span>{customer.phone}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation()
                            copyLink(customer.feedbackToken, customer.id)
                          }}
                        >
                          {copiedId === customer.id ? (
                            <>
                              <Check className="w-3.5 h-3.5 mr-1" /> Copied
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5 mr-1" /> Share link
                            </>
                          )}
                        </Button>
                        {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="border-t border-border bg-background p-4 space-y-4">
                        {/* Relationship override */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
                          <div>
                            <label className="block text-xs font-medium mb-1">Relationship indicator</label>
                            <select
                              value={draftRelationship}
                              onChange={(e) => setDraftRelationship(e.target.value as Customer["relationship"])}
                              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            >
                              {RELATIONSHIP_OPTIONS.map((r) => (
                                <option key={r.value} value={r.value}>{r.label}</option>
                              ))}
                            </select>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => saveCustomer(customer.id, { relationship: draftRelationship })}
                              disabled={savingId === customer.id}
                            >
                              {savingId === customer.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                              <span className="ml-1">Update Mood</span>
                            </Button>
                          </div>
                        </div>

                        {/* Tabs */}
                        <div className="flex flex-wrap gap-2 border-b border-border pb-2">
                          {[
                            { key: "checklist", label: "Delivery Checklist", icon: CheckCircle2 },
                            { key: "tickets", label: "Complaints & Resolutions", icon: MessageSquare },
                            { key: "testimonial", label: "Testimonial", icon: Star },
                            { key: "feedback", label: "Feedback", icon: ThumbsUp },
                          ].map((tab) => {
                            const Icon = tab.icon
                            return (
                              <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key as typeof activeTab)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                                  activeTab === tab.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
                                }`}
                              >
                                <Icon className="w-3.5 h-3.5" />
                                {tab.label}
                              </button>
                            )
                          })}
                        </div>

                        {activeTab === "checklist" && (
                          <div className="space-y-3">
                            {STEPS.map((step) => {
                              const item = draftChecks[step] || { done: false, remarks: "" }
                              return (
                                <div key={step} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-start p-3 rounded-md border border-border bg-muted/10">
                                  <label className="sm:col-span-3 flex items-center gap-2 text-sm font-medium capitalize pt-1">
                                    <input
                                      type="checkbox"
                                      checked={item.done}
                                      onChange={(e) =>
                                        setDraftChecks((prev) => ({
                                          ...prev,
                                          [step]: { ...item, done: e.target.checked },
                                        }))
                                      }
                                      className="w-4 h-4 rounded border-border"
                                    />
                                    {step}
                                  </label>
                                  <div className="sm:col-span-9">
                                    <label className="text-[10px] uppercase text-muted-foreground font-medium">Remarks</label>
                                    <textarea
                                      value={item.remarks}
                                      onChange={(e) =>
                                        setDraftChecks((prev) => ({
                                          ...prev,
                                          [step]: { ...item, remarks: e.target.value },
                                        }))
                                      }
                                      rows={2}
                                      className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                                      placeholder="Add remarks..."
                                    />
                                  </div>
                                </div>
                              )
                            })}
                            <Button
                              size="sm"
                              onClick={() => saveCustomer(customer.id, { checks: draftChecks })}
                              disabled={savingId === customer.id}
                            >
                              {savingId === customer.id ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Check className="w-3.5 h-3.5 mr-1" />}
                              Save Checklist
                            </Button>
                          </div>
                        )}

                        {activeTab === "tickets" && (
                          <div className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                              <div className="sm:col-span-3">
                                <label className="block text-xs font-medium mb-1">Type</label>
                                <select
                                  value={ticketType}
                                  onChange={(e) => setTicketType(e.target.value as "complaint" | "resolution")}
                                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                >
                                  <option value="complaint">Complaint</option>
                                  <option value="resolution">Resolution</option>
                                </select>
                              </div>
                              <div className="sm:col-span-7">
                                <label className="block text-xs font-medium mb-1">Note</label>
                                <textarea
                                  value={ticketNote}
                                  onChange={(e) => setTicketNote(e.target.value)}
                                  rows={2}
                                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                  placeholder="What happened / how was it resolved?"
                                />
                              </div>
                              <div className="sm:col-span-2">
                                <Button size="sm" className="w-full" onClick={() => addTicket(customer)} disabled={!ticketNote.trim()}>
                                  <Send className="w-3.5 h-3.5 mr-1" /> Add
                                </Button>
                              </div>
                            </div>

                            <div className="space-y-2">
                              {customer.tickets.length === 0 ? (
                                <p className="text-sm text-muted-foreground">No complaints or resolutions logged yet.</p>
                              ) : (
                                customer.tickets.map((t) => (
                                  <div key={t.id} className="flex items-start gap-3 p-3 rounded-md border border-border bg-muted/10">
                                    <span
                                      className={`text-[10px] uppercase px-1.5 py-0.5 rounded font-medium ${
                                        t.type === "complaint"
                                          ? "bg-red-50 text-red-700"
                                          : "bg-green-50 text-green-700"
                                      }`}
                                    >
                                      {t.type}
                                    </span>
                                    <div className="flex-1">
                                      <p className="text-sm whitespace-pre-wrap">{t.note}</p>
                                      <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                                        <Clock className="w-3 h-3" /> {formatDate(t.createdAt)}
                                      </p>
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        )}

                        {activeTab === "testimonial" && (
                          <div className="space-y-3">
                            <label className="block text-xs font-medium">Client testimonial</label>
                            <textarea
                              value={draftTestimonial}
                              onChange={(e) => setDraftTestimonial(e.target.value)}
                              rows={5}
                              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                              placeholder="Paste the testimonial here..."
                            />
                            <Button
                              size="sm"
                              onClick={() => saveCustomer(customer.id, { testimonial: draftTestimonial })}
                              disabled={savingId === customer.id}
                            >
                              {savingId === customer.id ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Check className="w-3.5 h-3.5 mr-1" />}
                              Save Testimonial
                            </Button>
                          </div>
                        )}

                        {activeTab === "feedback" && (
                          <div className="space-y-3">
                            {customer.feedback && Object.keys(customer.feedback).length > 0 ? (
                              <>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  {STEPS.map((step) => {
                                    const ratings = (customer.feedback.ratings as Record<string, number>) || {}
                                    const value = ratings[step] || 0
                                    return (
                                      <div key={step} className="flex items-center justify-between p-2 rounded-md border border-border bg-muted/10">
                                        <span className="text-sm font-medium capitalize">{step}</span>
                                        <StarRating value={value} />
                                      </div>
                                    )
                                  })}
                                </div>
                                {(customer.feedback.comment as string) && (
                                  <div className="p-3 rounded-md border border-border bg-muted/10">
                                    <p className="text-xs text-muted-foreground uppercase font-medium mb-1">Comment</p>
                                    <p className="text-sm whitespace-pre-wrap">{customer.feedback.comment as string}</p>
                                  </div>
                                )}
                                <p className="text-xs text-muted-foreground">
                                  Submitted: {customer.feedback.submittedAt ? formatDate(customer.feedback.submittedAt as string) : "Unknown"}
                                </p>
                              </>
                            ) : (
                              <div className="text-center py-6 text-muted-foreground">
                                <AlertCircle className="w-8 h-8 mx-auto mb-2" />
                                <p className="text-sm">No feedback yet.</p>
                                <p className="text-xs mt-1">Share the link above to collect ratings for every step.</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
