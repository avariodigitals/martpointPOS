import {
  getPartnerSession,
  getPartnerById,
  getPartnerUserById,
  getPartnerCapabilities,
} from "@/lib/partner-auth"
import {
  listPartnerComplianceDocuments,
  getPartnerActivity,
} from "@/lib/partner-service"
import { getPartnerDashboardMetrics } from "@/lib/partner-dashboard"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BadgeCheck, ShieldAlert, Calendar, MapPin, Building2, User } from "lucide-react"

function Metric({ value, label }: { value: number; label: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
      </CardContent>
    </Card>
  )
}

export default async function PartnerDashboardPage() {
  const session = await getPartnerSession()
  if (!session) return null

  const [partner, user, capabilities, documents, activity, metrics] = await Promise.all([
    getPartnerById(session.partnerId),
    getPartnerUserById(session.partnerUserId),
    getPartnerCapabilities(session.partnerId),
    listPartnerComplianceDocuments(session.partnerId),
    getPartnerActivity(session.partnerId, 10),
    getPartnerDashboardMetrics(session.partnerId),
  ])

  if (!partner || !user) return null

  const verified = partner.status === "ACTIVE"
  const pendingDocs = documents.filter((d) => ["REQUESTED", "SUBMITTED", "PENDING"].includes(d.verification_status as string))

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground">Welcome back, {user.fullName}.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Metric value={metrics.registeredLeads} label="Registered Leads" />
        <Metric value={metrics.protectedLeads} label="Protected Leads" />
        <Metric value={metrics.openOpportunities} label="Open Opportunities" />
        <Metric value={metrics.assignedCustomers} label="Assigned Customers" />
        <Metric value={metrics.customersOnboarding} label="Customers Onboarding" />
        <Metric value={metrics.tasksRequiringAttention} label="Tasks Requiring Attention" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium">Partner Organisation</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-retail-soft flex items-center justify-center text-retail font-bold text-xl">
                {(partner.displayName || partner.businessName).charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="font-semibold">{partner.displayName || partner.businessName}</p>
                <p className="text-xs text-muted-foreground font-mono">{partner.partnerId}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {verified ? <BadgeCheck className="w-4 h-4 text-green-600" /> : <ShieldAlert className="w-4 h-4 text-amber-500" />}
              <span>{verified ? "Verified Active Partner" : partner.status}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Building2 className="w-4 h-4" />
              <span>{partner.partnerType.replace(/_/g, " ")}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="w-4 h-4" />
              <span>{[partner.city, partner.state, partner.country].filter(Boolean).join(", ") || "—"}</span>
            </div>
            {partner.partnerSince && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="w-4 h-4" />
                <span>Partner since {new Date(partner.partnerSince).toLocaleDateString()}</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm font-medium">Your Account</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-retail-soft flex items-center justify-center text-retail font-bold">
                {user.fullName.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="font-semibold">{user.fullName}</p>
                <p className="text-xs text-muted-foreground">{user.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <User className="w-4 h-4" />
              <span>{user.role.replace("PARTNER_", "")}</span>
            </div>
            <div className="pt-2">
              <p className="text-xs font-medium mb-1">Organisation capabilities</p>
              {capabilities.length === 0 ? (
                <p className="text-xs text-muted-foreground">None granted yet.</p>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {capabilities.map((c) => (
                    <span key={c} className="text-[10px] uppercase px-2 py-0.5 rounded-full bg-retail-soft text-retail font-medium">
                      {c.replace(/_/g, " ")}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm font-medium">Compliance Summary</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {pendingDocs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No pending compliance actions.</p>
            ) : (
              <div className="space-y-2">
                {pendingDocs.slice(0, 5).map((d) => (
                  <div key={d.id as string} className="flex items-center justify-between text-sm">
                    <span>{d.document_type as string}</span>
                    <span className="text-[10px] uppercase px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 font-medium">
                      {d.verification_status as string}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm font-medium">Recent Activity</CardTitle></CardHeader>
        <CardContent>
          {activity.length === 0 ? (
            <p className="text-sm text-muted-foreground">No recent activity.</p>
          ) : (
            <div className="space-y-2">
              {activity.slice(0, 10).map((a, i) => (
                <div key={i} className="flex items-center justify-between text-sm border-b border-border last:border-0 pb-2 last:pb-0">
                  <span className="font-medium">{a.action as string}</span>
                  <span className="text-xs text-muted-foreground">
                    {a.created_at ? new Date(a.created_at as string).toLocaleString() : "—"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
