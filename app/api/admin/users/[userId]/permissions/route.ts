import { NextResponse } from "next/server"
import { getSession } from "@/lib/admin-auth"
import { CREATOR_PERMISSIONS, CAREERS_PERMISSIONS, ROLE_PERMISSIONS } from "@/lib/admin-types"
import { FINANCE_PERMISSION_KEYS, hasFinanceAction } from "@/lib/finance-permissions"
import { supabase } from "@/lib/supabase"
import { auditContextFromSession, recordAudit, AUDIT_ENTITIES } from "@/lib/audit"

export const dynamic = "force-dynamic"
type Context = { params: Promise<{ userId: string }> }
const permissionKeys = new Set<string>([
  ...Object.values(ROLE_PERMISSIONS).flat(), ...CREATOR_PERMISSIONS, ...CAREERS_PERMISSIONS, ...FINANCE_PERMISSION_KEYS,
])
const fail = (message: string, status = 400) => NextResponse.json({ success: false, error: message }, { status })

async function adminSession() {
  const session = await getSession()
  if (!session) return { session: null, response: fail("Unauthorized", 401) }
  if (session.role !== "Admin") return { session: null, response: fail("Only Admin can edit personal permission overrides", 403) }
  return { session, response: null }
}

export async function GET(_request: Request, context: Context) {
  const auth = await adminSession()
  if (auth.response || !auth.session) return auth.response
  const { userId } = await context.params
  const [user, overrides] = await Promise.all([
    supabase.from("users").select("id,name,username,role,status").eq("id", userId).maybeSingle(),
    supabase.from("user_permission_overrides").select("permission_key,effect,updated_at").eq("user_id", userId),
  ])
  if (user.error || !user.data) return fail("User not found", 404)
  if (overrides.error) return fail("Apply migration 168 to manage personal permission overrides", 503)
  const role = user.data.role as keyof typeof ROLE_PERMISSIONS
  const roleRules = await supabase.from("role_permission_overrides").select("permission_key,effect").eq("role_name", role)
  const roleAllowed = new Set([...(ROLE_PERMISSIONS[role] || []), ...FINANCE_PERMISSION_KEYS.filter((key) => hasFinanceAction(role, key))])
  if (!roleRules.error) for (const rule of roleRules.data || []) {
    if (rule.effect === "allow") roleAllowed.add(rule.permission_key)
    if (rule.effect === "deny") roleAllowed.delete(rule.permission_key)
  }
  const rolePermissions = [...roleAllowed]
  return NextResponse.json({ success: true, user: user.data, overrides: overrides.data || [], permissionKeys: [...permissionKeys].sort(), rolePermissions })
}

export async function PUT(request: Request, context: Context) {
  const auth = await adminSession()
  if (auth.response || !auth.session) return auth.response
  const { userId } = await context.params
  try {
    const body = await request.json() as { overrides?: { permission_key: string; effect: string }[] }
    const { data: target, error: targetError } = await supabase.from("users").select("id,role").eq("id", userId).maybeSingle()
    if (targetError || !target) return fail("User not found", 404)
    if (target.role === "Admin") return fail("Personal overrides are not available for Admin accounts")
    const rows = Array.isArray(body.overrides) ? body.overrides : []
    if (rows.some((item) => !permissionKeys.has(item.permission_key) || !["allow", "deny"].includes(item.effect))) return fail("One or more permission overrides are invalid")
    const unique = [...new Map(rows.map((item) => [item.permission_key, item])).values()]
    if (unique.length) {
      const { error: insertError } = await supabase.from("user_permission_overrides").upsert(unique.map((item) => ({
        user_id: userId, permission_key: item.permission_key, effect: item.effect, updated_by: auth.session!.userId,
      })), { onConflict: "user_id,permission_key" })
      if (insertError) return fail("Could not save permission overrides", 500)
    }
    const keep = new Set(unique.map((item) => item.permission_key))
    const current = await supabase.from("user_permission_overrides").select("permission_key").eq("user_id", userId)
    if (current.error) return fail("Overrides were saved, but the previous state could not be reconciled", 500)
    for (const item of current.data || []) {
      if (!keep.has(item.permission_key)) {
        const removed = await supabase.from("user_permission_overrides").delete().eq("user_id", userId).eq("permission_key", item.permission_key)
        if (removed.error) return fail("Some removed overrides could not be cleared", 500)
      }
    }
    await recordAudit(auditContextFromSession(auth.session, request), {
      action: "ADMIN_USER_PERMISSION_OVERRIDES_UPDATED",
      entityType: AUDIT_ENTITIES.ADMIN_USER,
      entityId: userId,
      metadata: { permission_overrides: unique.map((item) => ({ permission_key: item.permission_key, effect: item.effect })) },
    })
    return NextResponse.json({ success: true, count: unique.length })
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Could not save overrides", 400)
  }
}
