import { NextResponse } from "next/server"
import { getSession } from "@/lib/admin-auth"
import { supabase } from "@/lib/supabase"
import { FINANCE_PERMISSION_KEYS, hasFinanceActionForUser } from "@/lib/finance-permissions"

export const dynamic = "force-dynamic"
export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const [overrides, policies] = await Promise.all([
    supabase.from("user_permission_overrides").select("permission_key,effect").eq("user_id", session.userId),
    supabase.from("approval_policies").select("action_key,enabled,approver_roles,approver_user_ids"),
  ])
  if (overrides.error || policies.error) return NextResponse.json({ error: "Apply migrations 167 and 168 to load permissions" }, { status: 503 })
  const roles = session.roles?.length ? session.roles : [session.role]
  const roleRules = await supabase.from("role_permission_overrides").select("permission_key,effect").in("role_name", roles)
  const values = (roleRules.error ? [] : roleRules.data || []).reduce((acc, item) => {
    const existing = acc[item.permission_key]
    if (existing !== "deny") acc[item.permission_key] = item.effect === "deny" ? "deny" : "allow"
    return acc
  }, {} as Record<string, string>)
  for (const item of overrides.data || []) values[item.permission_key] = item.effect
  const assignedApprover = (policies.data || []).some((policy) => policy.enabled && (
    (Array.isArray(policy.approver_roles) && roles.some((role) => policy.approver_roles.includes(role))) ||
    (Array.isArray(policy.approver_user_ids) && policy.approver_user_ids.includes(session.userId))
  ))
  if (assignedApprover && values.approvals !== "deny") values.approvals = "allow"
  const financeActions = Object.fromEntries(await Promise.all(FINANCE_PERMISSION_KEYS.map(async (key) => [key, await hasFinanceActionForUser(session.userId, session.role, key)])))
  const approvalActions = Object.fromEntries((policies.data || []).map((policy) => [policy.action_key, policy.enabled === true]))
  return NextResponse.json({ overrides: values, financeActions, approvalActions, userId: session.userId, username: session.username, role: session.role, roles, businessUnit: session.businessUnit || "" })
}
