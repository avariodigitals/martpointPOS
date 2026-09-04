import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Command } from "lucide-react"

export default function AuditPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Audit Logs</h2>
        <p className="text-muted-foreground">Cross-module audit event viewer.</p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Command className="w-4 h-4 text-muted-foreground" />
            Audit filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Audit events are recorded in <code>finance_audit_events</code> for finance, support,
            customer-success, compliance and incident actions.
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Future releases will include actor, action, entity, and date-range filters directly in
            this viewer. Raw audit data remains available through the Supabase dashboard or service
            queries.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
