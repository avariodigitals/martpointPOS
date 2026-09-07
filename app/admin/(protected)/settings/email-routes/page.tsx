"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, Save, Route, ArrowLeft } from "lucide-react"

interface RouteDef {
  key: string
  label: string
  description: string
}

const ROUTES: RouteDef[] = [
  {
    key: "lead_submission",
    label: "Lead / Quote Request",
    description: "Public lead capture forms (e.g. homepage, pricing)",
  },
  {
    key: "career_application",
    label: "Careers / CV",
    description: "Career applications with CV attachments",
  },
  {
    key: "partner_application",
    label: "Partner Application",
    description: "Admin copy of partner applications",
  },
  {
    key: "support_ticket",
    label: "Support Ticket",
    description: "New customer support ticket notifications",
  },
]

export default function EmailRoutesPage() {
  const [routes, setRoutes] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")

  useEffect(() => {
    fetch("/api/admin/settings", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        const loaded = (data.email?.routes as Record<string, string> | undefined) || {}
        const defaults = Object.fromEntries(ROUTES.map((r) => [r.key, ""]))
        setRoutes({ ...defaults, ...loaded })
      })
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMessage("")

    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: { routes } }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setMessage("Email routes saved successfully.")
      } else {
        setMessage(data.error || "Failed to save email routes.")
      }
    } catch {
      setMessage("Network error. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/settings" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Settings
        </Link>
        <h2 className="text-2xl font-bold tracking-tight mt-2 flex items-center gap-2">
          <Route className="w-5 h-5" />
          Email Routes
        </h2>
        <p className="text-muted-foreground">Control where each form/notification email is sent.</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <form onSubmit={handleSave}>
          <Card>
            <CardHeader>
              <CardTitle>Recipient Routing</CardTitle>
              <CardDescription>
                Leave a route empty to fall back to the general Notify Email in Email Settings. Separate multiple addresses with commas.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {ROUTES.map((route) => (
                <div key={route.key}>
                  <label className="block text-sm font-medium mb-1">{route.label}</label>
                  <input
                    type="text"
                    value={routes[route.key] || ""}
                    onChange={(e) => setRoutes((prev) => ({ ...prev, [route.key]: e.target.value }))}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    placeholder="admin@martpoint.com.ng, sales@martpoint.com.ng"
                  />
                  <p className="text-xs text-muted-foreground mt-1">{route.description}</p>
                </div>
              ))}

              {message && (
                <p className={`text-sm ${message.includes("success") ? "text-green-600" : "text-red-600"}`}>
                  {message}
                </p>
              )}
            </CardContent>
            <CardFooter className="border-t pt-4 flex items-center justify-end">
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save Email Routes
              </Button>
            </CardFooter>
          </Card>
        </form>
      )}
    </div>
  )
}
