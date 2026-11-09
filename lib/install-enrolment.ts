import { supabase, isSupabaseConfigured } from "./supabase"

function logEnrollmentFailure(reason: string): void {
  // Never include install_key or the issued check-in token in server logs.
  console.warn(`[usage-enroll] ${reason}`)
}

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
  if (!isSupabaseConfigured()) { logEnrollmentFailure("Supabase is not configured"); return null }
  if (installKey.length < 32 || installKey.length > 255) { logEnrollmentFailure("install key length was rejected"); return null }
  const root = installationRoot(installUrl)
  const central = installationRoot(process.env.FLEET_CENTRAL_URL || "https://central.martpoint.com.ng/")
  if (!root) {
    let location = "malformed URL"
    try { const parsed = new URL(installUrl); location = `scheme=${parsed.protocol}, host=${parsed.hostname}` } catch { /* keep generic */ }
    logEnrollmentFailure(`install URL rejected (${location}); a public HTTPS root without query or fragment is required`)
    return null
  }
  if (!central) { logEnrollmentFailure("FLEET_CENTRAL_URL is invalid"); return null }
  const { data: deployments, error } = await supabase.from("business_deployments")
    .select("business_id, environment_url")
  if (error) { logEnrollmentFailure(`deployment lookup failed: ${error.message}`); return null }
  // The deployment environment root is authoritative; marketing/storefront URLs aren't proof.
  const ids = new Set<string>()
  for (const d of deployments || []) if (installationRoot(String(d.environment_url || "")) === root) ids.add(d.business_id)
  if (ids.size !== 1) { logEnrollmentFailure(`install URL matched ${ids.size} deployment records; exactly one is required`); return null }
  try {
    const proof = await fetch(`${central}fleet/verify_usage_install`, {
      // This is called from the Retail app's separate background usage request.
      // Allow ordinary shared-hosting latency and TLS setup; the caller has a
      // larger enrollment timeout and failed proof still fails closed.
      method: "POST", redirect: "error", cache: "no-store", signal: AbortSignal.timeout(6000),
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ install_url: root, install_key: installKey }),
    })
    if (!proof.ok) { logEnrollmentFailure(`Central Fleet proof returned HTTP ${proof.status}`); return null }
    if ((await proof.json()).verified !== true) { logEnrollmentFailure("Central Fleet did not verify this install URL and private key"); return null }
    const { data, error: issueError } = await supabase.rpc("issue_install_checkin_token", {
      p_business_id: [...ids][0], p_rotate: false,
    })
    if (issueError) logEnrollmentFailure(`token issuance failed: ${issueError.message}`)
    return !issueError && typeof data === "string" ? data : null
  } catch (error) {
    logEnrollmentFailure(error instanceof Error ? `Central Fleet request failed: ${error.message}` : "enrollment request failed")
    return null
  }
}
