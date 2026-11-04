import { NextResponse } from "next/server"
import { getSession } from "@/lib/admin-auth"
import { ALL_ROLES, CAREERS_PERMISSIONS, CREATOR_PERMISSIONS, ROLE_PERMISSIONS, type UserRole } from "@/lib/admin-types"
import { FINANCE_PERMISSION_KEYS } from "@/lib/finance-permissions"
import { adminNavItems } from "@/lib/admin-navigation"
import { supabase } from "@/lib/supabase"
import { auditContextFromSession, recordAudit, AUDIT_ENTITIES } from "@/lib/audit"

export const dynamic = "force-dynamic"
const fail = (message: string, status = 400) => NextResponse.json({ success: false, error: message }, { status })
const permissionKeys = [...new Set([
  ...Object.values(ROLE_PERMISSIONS).flat(), ...CREATOR_PERMISSIONS, ...CAREERS_PERMISSIONS,
  ...FINANCE_PERMISSION_KEYS, ...adminNavItems.map((item) => item.page),
])].sort()

async function adminSession() {
  const session = await getSession()
  if (!session) return { session: null, response: fail("Unauthorized", 401) }
  if (session.role !== "Admin") return { session: null, response: fail("Only Admin can edit global role permissions", 403) }
  return { session, response: null }
}

export async function GET() {
  const auth = await adminSession()
  if (auth.response || !auth.session) return auth.response
  const result = await supabase.from("role_permission_overrides").select("role_name,permission_key,effect,updated_at").order("role_name").order("permission_key")
  if (result.error) return fail("Apply migration 171 to edit role permissions", 503)
  return NextResponse.json({ success: true, roles: ALL_ROLES.filter((role) => role !== "Admin"), permissionKeys, baselines: ROLE_PERMISSIONS, overrides: result.data || [] })
}

export async function PUT(request: Request) {
  const auth = await adminSession()
  if (auth.response || !auth.session) return auth.response
  try {
    const body = await request.json() as { role?: string; overrides?: { permission_key: string; effect: string }[] }
    const role = String(body.role || "") as UserRole
    if (!ALL_ROLES.includes(role) || role === "Admin") return fail("Choose a valid non-Admin role")
    const rows = Array.isArray(body.overrides) ? body.overrides : []
    if (rows.some((item) => !permissionKeys.includes(item.permission_key) || !["allow", "deny"].includes(item.effect))) return fail("One or more role permission rules are invalid")
    const unique = [...new Map(rows.map((item) => [item.permission_key, item])).values()]
    const removed = await supabase.from("role_permission_overrides").delete().eq("role_name", role)
    if (removed.error) return fail("Could not replace role permission rules", 500)
    if (unique.length) {
      const saved = await supabase.from("role_permission_overrides").insert(unique.map((item) => ({
        role_name: role, permission_key: item.permission_key, effect: item.effect, updated_by: auth.session!.userId,
      })))
      if (saved.error) return fail("Could not save role permission rules", 500)
    }
    await recordAudit(auditContextFromSession(auth.session, request), {
      action: "ADMIN_ROLE_PERMISSIONS_UPDATED", entityType: AUDIT_ENTITIES.ADMIN_USER, entityId: auth.session.userId,
      metadata: { role, permission_overrides: unique.map((item) => ({ permission_key: item.permission_key, effect: item.effect })) },
    })
    return NextResponse.json({ success: true, count: unique.length })
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Could not save role permissions", 400)
  }
}
