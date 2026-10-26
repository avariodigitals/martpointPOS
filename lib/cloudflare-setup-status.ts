/** Client-safe setup instructions. Never returns or accepts permanent secrets. */
export type CloudflareSetupStatus = {
  selected: boolean; appConfigured: boolean; turnConfigured: boolean;
  cleanupConfigured: boolean; schemaReady: boolean; enabled: boolean;
  liveVerified: false; checkedAt: string;
};

export const CLOUDFLARE_SETUP_CHECKS = [
  { key: "appConfigured", label: "SFU application", action: "Add CLOUDFLARE_REALTIME_APP_ID and CLOUDFLARE_REALTIME_APP_SECRET in Vercel, then redeploy." },
  { key: "turnConfigured", label: "TURN relay", action: "Create a separate TURN key in Cloudflare. Add CLOUDFLARE_TURN_KEY_ID and CLOUDFLARE_TURN_API_TOKEN in Vercel, then redeploy." },
  { key: "schemaReady", label: "Database media state", action: "Check database connectivity and apply migration 136 after 135. Retry once the schema is available." },
  { key: "cleanupConfigured", label: "Cleanup configuration", action: "Set CRON_SECRET in Vercel, redeploy and verify the cleanup job runs every five minutes. This check detects the secret only, not the running schedule." },
  { key: "selected", label: "Selected for website calls", action: "After the other checks pass, set AZERA_BROWSER_MEDIA=cloudflare in the intended Vercel environment and redeploy. Then test on separate devices." },
] as const;

export async function fetchCloudflareSetupStatus(signal: AbortSignal): Promise<CloudflareSetupStatus> {
  const response = await fetch("/api/azera/cloudflare", { cache: "no-store", signal });
  if (response.status === 401) throw new Error("Your admin session has expired. Please sign in again, then refresh.");
  if (response.status === 403) throw new Error("Your account needs Settings access to check website calling.");
  if (!response.ok) throw new Error("Cloudflare setup could not be checked. Please retry.");
  const status = await response.json();
  if (!status || CLOUDFLARE_SETUP_CHECKS.some(check => typeof status[check.key] !== "boolean") ||
      typeof status.enabled !== "boolean" || typeof status.checkedAt !== "string" || Number.isNaN(Date.parse(status.checkedAt))) {
    throw new Error("The setup check returned an invalid response. Refresh the page and retry.");
  }
  return status as CloudflareSetupStatus;
}
