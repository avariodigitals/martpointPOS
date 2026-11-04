import type { UserRole } from "./admin-types"
import { supabase } from "./supabase"

/** Role permissions are the baseline; a per-person row explicitly allows or denies one key. */
export async function hasEffectivePermission(userId: string, role: UserRole, permissionKey: string, roleAllowed: boolean): Promise<boolean> {
  if (role === "Admin") return true
  const { data, error } = await supabase.from("user_permission_overrides").select("effect")
    .eq("user_id", userId).eq("permission_key", permissionKey).maybeSingle()
  if (error) return false
  if (data?.effect === "allow") return true
  if (data?.effect === "deny") return false
  return roleAllowed
}
