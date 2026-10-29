export function extractEmailAddresses(value: unknown): string[] {
  if (typeof value !== "string") return []
  return [...new Set((value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || []).map((address) => address.toLowerCase()))]
}

export function leadReplyRecipients(
  original: { direction: string; fromEmail: string | null; toEmail: string | null; metadata?: Record<string, unknown> | null },
  lead: { email: string; additionalEmail?: string | null },
  ownAddresses: string[], replyAll: boolean,
): { to: string[]; cc: string[] } {
  const own = new Set(ownAddresses.flatMap(extractEmailAddresses))
  const saved = [lead.email, lead.additionalEmail || ""].flatMap(extractEmailAddresses)
  let to = extractEmailAddresses(original.direction === "inbound" ? original.fromEmail : original.toEmail).filter((address) => !own.has(address))
  if (!to.length) to = saved.filter((address) => !own.has(address))
  const cc = replyAll ? [...new Set([
    ...extractEmailAddresses(original.toEmail), ...extractEmailAddresses(original.metadata?.cc), ...saved,
  ])].filter((address) => !own.has(address) && !to.includes(address)) : []
  return { to, cc }
}
