import type { UserRole } from "./admin-types"
import { supabase } from "./supabase"

/** Role permissions are the baseline; a per-person row explicitly allows or denies one key. */
export async function hasEffectivePermission(userId: string, role: UserRole | UserRole[], permissionKey: string, roleAllowed: boolean): Promise<boolean> {
  const roles = Array.isArray(role) ? role : [role]
  if (roles.includes("Admin") || roles.includes("Super Admin")) return true
  const [personal, global] = await Promise.all([
    supabase.from("user_permission_overrides").select("effect").eq("user_id", userId).eq("permission_key", permissionKey).maybeSingle(),
    supabase.from("role_permission_overrides").select("role_name,effect").in("role_name", roles).eq("permission_key", permissionKey),
  ])
  if (personal.error) return false
  if (personal.data?.effect === "allow") return true
  if (personal.data?.effect === "deny") return false
  if (!global.error) {
    const effects = (global.data || []).map((row) => row.effect)
    if (effects.includes("deny")) return false
    if (effects.includes("allow")) return true
  }
  return roleAllowed
}

export const hasEffectivePermissionForRoles = hasEffectivePermission
