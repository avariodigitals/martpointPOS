import type { UserRole } from "./admin-types"
import { supabase } from "./supabase"

/** Role permissions are the baseline; a per-person row explicitly allows or denies one key. */
export async function hasEffectivePermission(userId: string, role: UserRole, permissionKey: string, roleAllowed: boolean): Promise<boolean> {
  if (role === "Admin") return true
  const [personal, global] = await Promise.all([
    supabase.from("user_permission_overrides").select("effect").eq("user_id", userId).eq("permission_key", permissionKey).maybeSingle(),
    supabase.from("role_permission_overrides").select("effect").eq("role_name", role).eq("permission_key", permissionKey).maybeSingle(),
  ])
  if (personal.error) return false
  if (personal.data?.effect === "allow") return true
  if (personal.data?.effect === "deny") return false
  if (!global.error && global.data?.effect === "allow") return true
  if (!global.error && global.data?.effect === "deny") return false
  return roleAllowed
}
