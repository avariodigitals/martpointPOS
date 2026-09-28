/** OAuth redirect URI — must match one registered on the Google Cloud OAuth client. */
export function googleRedirectUri(request: Request): string {
  if (process.env.GOOGLE_REDIRECT_URI) return process.env.GOOGLE_REDIRECT_URI
  const url = new URL(request.url)
  const proto = request.headers.get("x-forwarded-proto") || url.protocol.replace(":", "")
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || url.host
  return `${proto}://${host}/api/admin/google/callback`
}

export const GOOGLE_OAUTH_STATE_COOKIE = "mp_google_oauth_state"
