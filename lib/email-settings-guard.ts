/* ─── Email settings guard ───
 * Settings → Email asks for server names, but the fields are easy to fill with
 * an address ("mail@martpoint.com.ng" instead of "mail.martpoint.com.ng"). That
 * silently kills the lead mailbox: IMAP never connects, so replies never import,
 * and SMTP fails with "getaddrinfo ENOTFOUND".
 *
 * The settings screen warns about it, but a warning did not stop it being saved,
 * so the API rejects it too. This is the one place that decides what is valid.
 */

/** A host field must not contain "@" or spaces — that means it is an address. */
export function isBadHost(value: string | undefined | null): boolean {
  const v = String(value || "").trim()
  return Boolean(v) && /[@\s]/.test(v)
}

/**
 * Returns a human-readable reason the email settings must not be saved, or null
 * when they are acceptable. Only rejects clearly-wrong values so a legitimate
 * setup (internal relay, IP literal, bare hostname) is never blocked.
 */
export function validateEmailSettings(email: Record<string, unknown>): string | null {
  if (email.profileSignatureScale !== undefined && (
    typeof email.profileSignatureScale !== "number" || !Number.isFinite(email.profileSignatureScale) ||
    email.profileSignatureScale < 40 || email.profileSignatureScale > 100
  )) return "Profile signature size must be between 40% and 100%."
  const smtp = (email.smtp || {}) as Record<string, unknown>
  const imap = (email.imap || {}) as Record<string, unknown>

  const hosts: [string, unknown][] = [
    ["SMTP host", smtp.host],
    ["IMAP host", imap.host],
  ]
  for (const [label, value] of hosts) {
    if (isBadHost(value as string)) {
      const host = String(value).trim()
      return `${label} "${host}" was not saved — that is an email address, not a server name. Use the host only, e.g. mail.martpoint.com.ng (no @, no spaces).`
    }
  }

  // The account-level From is passed straight to the provider, so a bare
  // display name ("MartPoint Solutions") there would be refused as invalid.
  const fromEmail = String(email.fromEmail || "").trim()
  if (fromEmail && !fromEmail.includes("@")) {
    return `From address "${fromEmail}" was not saved — it must be a real address, e.g. MartPoint Sales <sales@martpoint.com.ng> or sales@martpoint.com.ng.`
  }

  return null
}
