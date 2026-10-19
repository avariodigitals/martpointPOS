import { supabase, isSupabaseConfigured } from "./supabase"

/** Canonical deployment root, preserving folders and rejecting credentials. */
export function installationRoot(value: string): string | null {
  try {
    const u = new URL(value)
    if (u.protocol !== "https:" || u.username || u.password || u.search || u.hash) return null
    u.hostname = u.hostname.toLowerCase()
    u.pathname = u.pathname.replace(/\/+$/, "") + "/"
    return u.toString()
  } catch { return null }
}

/** Trust the configured Central only, never a callback supplied by an install. */
export async function enrolInstall(installUrl: string, installKey: string): Promise<string | null> {
  if (!isSupabaseConfigured() || installKey.length < 32 || installKey.length > 255) return null
  const root = installationRoot(installUrl)
  const central = installationRoot(process.env.FLEET_CENTRAL_URL || "https://central.martpoint.com.ng/")
  if (!root || !central) return null
  const { data: deployments, error } = await supabase.from("business_deployments")
    .select("business_id, environment_url")
  if (error) return null
  // The deployment environment root is authoritative; marketing/storefront URLs aren't proof.
  const ids = new Set<string>()
  for (const d of deployments || []) if (installationRoot(String(d.environment_url || "")) === root) ids.add(d.business_id)
  if (ids.size !== 1) return null
  try {
    const proof = await fetch(`${central}fleet/verify_usage_install`, {
      method: "POST", redirect: "error", cache: "no-store", signal: AbortSignal.timeout(1800),
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ install_url: root, install_key: installKey }),
    })
    if (!proof.ok) return null
    const proofBody = await proof.json() as {
      verified?: boolean
      fleet_id?: string | null
      installation_id?: string | null
      identity_status?: string | null
    }
    if (proofBody.verified !== true) return null
    if (proofBody.fleet_id && proofBody.installation_id) {
      await supabase.from("business_deployments").update({
        fleet_id: proofBody.fleet_id,
        installation_id: proofBody.installation_id,
        identity_status: "REVIEW_REQUIRED",
        identity_verified_at: null,
        identity_last_reconciled_at: new Date().toISOString(),
        identity_issue: "Central proof succeeded but business ownership still requires Central review.",
      }).eq("business_id", [...ids][0])
    }
    const { data, error: issueError } = await supabase.rpc("issue_install_checkin_token", {
      p_business_id: [...ids][0], p_rotate: false,
    })
    return !issueError && typeof data === "string" ? data : null
  } catch { return null }
}
