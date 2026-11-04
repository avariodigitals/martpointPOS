import { NextResponse } from "next/server"
import { getSession } from "@/lib/admin-auth"
import { supabase } from "@/lib/supabase"

export const dynamic = "force-dynamic"
export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const [overrides, policies] = await Promise.all([
    supabase.from("user_permission_overrides").select("permission_key,effect").eq("user_id", session.userId),
    supabase.from("approval_policies").select("approver_roles,approver_user_ids"),
  ])
  if (overrides.error || policies.error) return NextResponse.json({ error: "Apply migrations 167 and 168 to load permissions" }, { status: 503 })
  const values = Object.fromEntries((overrides.data || []).map((item) => [item.permission_key, item.effect])) as Record<string, string>
  const assignedApprover = (policies.data || []).some((policy) =>
    (Array.isArray(policy.approver_roles) && policy.approver_roles.includes(session.role)) ||
    (Array.isArray(policy.approver_user_ids) && policy.approver_user_ids.includes(session.userId)),
  )
  if (assignedApprover && values.approvals !== "deny") values.approvals = "allow"
  return NextResponse.json({ overrides: values })
}
