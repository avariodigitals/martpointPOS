"use client"

import { useEffect, useState } from "react"

interface Lead {
  id: string
  businessName: string
  contactName: string
  partnerId: string
  status: string
  protectionStatus: string
  protectionExpiresAt: string | null
  createdAt: string
}

export default function AdminPartnerLeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/admin/partner-leads")
      .then((r) => r.json())
      .then((data) => setLeads(data.leads || []))
      .finally(() => setLoading(false))
  }, [])

  async function act(lead: Lead, action: string, status?: string) {
    const body: Record<string, unknown> = { id: lead.id, action }
    if (status) body.protectionStatus = status
    if (status === "PROTECTED") body.protectionDays = 30
    if (action === "convert") body.action = "convert"

    const res = await fetch("/api/admin/partner-leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (res.ok) {
      setLeads((prev) => prev.map((l) => (l.id === lead.id ? data.lead || l : l)))
    }
  }

  if (loading) return <p>Loading...</p>

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Partner Leads</h2>
      {leads.length === 0 ? (
        <p className="text-muted-foreground">No partner leads.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="px-4 py-2 text-left">Business</th>
                <th className="px-4 py-2 text-left">Contact</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2 text-left">Protection</th>
                <th className="px-4 py-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.id} className="border-t border-border">
                  <td className="px-4 py-2 font-medium">{lead.businessName}</td>
                  <td className="px-4 py-2">{lead.contactName}</td>
                  <td className="px-4 py-2">{lead.status}</td>
                  <td className="px-4 py-2">{lead.protectionStatus}</td>
                  <td className="px-4 py-2 flex gap-2">
                    {lead.protectionStatus === "PENDING" && (
                      <>
                        <button onClick={() => act(lead, "decide", "PROTECTED")} className="text-xs bg-green-100 text-green-800 rounded px-2 py-1">Protect</button>
                        <button onClick={() => act(lead, "decide", "REJECTED")} className="text-xs bg-red-100 text-red-800 rounded px-2 py-1">Reject</button>
                      </>
                    )}
                    <button onClick={() => act(lead, "decide", "QUALIFIED")} className="text-xs bg-blue-100 text-blue-800 rounded px-2 py-1">Qualify</button>
                    <button onClick={() => act(lead, "convert")} disabled={lead.status !== "WON"} className="text-xs bg-retail/10 text-retail rounded px-2 py-1 disabled:opacity-50">Convert</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
