export function recipientEmails(value: string, optional = false): string[] {
  const addresses = [...new Set(value.split(/[,;\n]+/).map((item) => item.trim()).filter(Boolean))]
  if (!addresses.length && !optional) throw new Error("Enter at least one recipient email address.")
  if (addresses.length > 20 || addresses.some((item) => item.length > 254 || !/^[^\s<>@,;:]+@[^\s<>@,;:]+\.[^\s<>@,;:]+$/.test(item))) {
    throw new Error("Enter valid email addresses, separated by commas, semicolons or new lines.")
  }
  return addresses
}

export function accessEmailSubject(businessName: string) {
  return `Welcome to MartPoint — Your Access Details (${businessName})`
}

/** Preserve the exact installation path; never invent a hostname or /login. */
export function accessLink(value: unknown, label = "Login URL", optional = false): string {
  if (optional && (value == null || value === "")) return ""
  if (typeof value !== "string" || !value.trim() || value.length > 2048) throw new Error(`Enter the actual ${label}.`)
  const input = value.trim()
  let url: URL
  try { url = new URL(input) } catch { throw new Error(`${label} must be a complete http:// or https:// address.`) }
  const host = url.hostname.toLowerCase()
  if (!/^https?:\/\/[^/]/i.test(input) || !/^https?:$/.test(url.protocol) || url.username || url.password || /[\s<>"{}\\]/.test(input)
    || !host.includes(".")
    || /(^localhost$|\.localhost$|\.local$|\.internal$|\.invalid$)/.test(host)
    || /^\[|^127\.|^10\.|^192\.168\.|^169\.254\.|^0\.|^172\.(1[6-9]|2\d|3[01])\./.test(host)) {
    throw new Error(`${label} must be the public business address, without embedded credentials or placeholders.`)
  }
  return input
}

export function accessMessageLinks(message: string, softwareUrl: string, previousUrl = "", onlineStoreUrl?: string, previousStoreUrl = "") {
  let result = previousUrl && previousUrl !== softwareUrl ? message.replaceAll(previousUrl, softwareUrl) : message
  result = result.replace(/^(?:Software URL|Login URL|Store \/ Login URL):[^\r\n]*$/gmi, () => `Software URL: ${softwareUrl}`)
  if (!/^Software URL:/im.test(result)) result += `\n\nSoftware URL: ${softwareUrl}`
  if (onlineStoreUrl !== undefined) {
    if (previousStoreUrl && previousStoreUrl !== onlineStoreUrl) result = result.replaceAll(previousStoreUrl, onlineStoreUrl)
    result = result.replace(/^Online Store:[^\r\n]*$/gmi, () => onlineStoreUrl ? `Online Store: ${onlineStoreUrl}` : "")
  }
  return result
}

/** Update labelled values without discarding custom paragraphs in a resend. */
export function updateAccessMessageField(message: string, key: string, value: string, previous = "") {
  if (key === "softwareUrl") return accessMessageLinks(message, value, previous)
  if (key === "additionalUsers") {
    const block = /^Additional Users:\n[^]*?(?=\n\n|$)/m
    const replacement = value.trim() ? `Additional Users:\n${value.trim()}` : ""
    return block.test(message) ? message.replace(block, () => replacement) : replacement ? `${message}\n\n${replacement}` : message
  }
  if (key === "supportGroupUrl") {
    if (previous && message.includes(previous)) return message.replaceAll(previous, value)
    return value ? `${message}\n\nSupport group: ${value}` : message
  }
  const labels: Record<string, string> = {
    softwareUrl: "Software URL", adminUsername: "Admin Username/Email", tempPassword: "Temporary Password",
    onlineStoreUrl: "Online Store", supportContact: "Your MartPoint Support Contact", trainingSchedule: "Training Date & Time",
  }
  const label = labels[key]
  if (!label) return message
  const expression = new RegExp(`^${label}:.*$`, "gm")
  if (expression.test(message)) return message.replace(expression, () => `${label}: ${value}`)
  return value ? `${message}\n\n${label}: ${value}` : message
}

export function accessEmailText(message: string, note?: string) {
  const currentPhone = "+2342017001229"
  let normalizedMessage = message
    .replace(/\+?234[\s().-]*803[\s().-]*797[\s().-]*8230|0[\s().-]*803[\s().-]*797[\s().-]*8230/g, currentPhone)
  const emailNotice = "Transactional email allowance\nUp to 1,000 business transactional email recipients per store each Lagos calendar month. This includes storefront order and appointment emails, invoices, quotations, payment receipts, payment links, order progress updates and similar non-promotional messages. Owner/branch alerts and customer messages each count as a recipient. Promotional campaigns and newsletters require email credits. MartPoint account security and system emails are separate and do not use this store allowance. Transactional emails pause when the allowance is reached and resume next month."
  const oldNotices = [
    "Email sending allowance\n\nTransactional email cap: 1,000 emails per month. Promotional emails, including campaigns and newsletters, require messaging credits.",
    "Storefront email allowance\n\nUp to 1,000 order and appointment email recipients per store each month. Owner/branch alerts and customer confirmations each count as a recipient.\n\nOther transactional emails, including invoices, quotations, payment receipts, payment links and order progress updates, require email credits. Promotional campaigns and newsletters also require credits. MartPoint account access emails, such as staff invitations and password resets, are platform emails and do not use this store allowance.",
  ]
  for (const oldNotice of oldNotices) normalizedMessage = normalizedMessage.replaceAll(oldNotice, emailNotice)
  const withNotice = /Transactional email allowance/i.test(normalizedMessage)
    ? normalizedMessage
    : `${normalizedMessage.trim()}\n\n${emailNotice}`
  return note?.trim() ? `${withNotice.trim()}\n\n${note.trim()}` : withNotice
}
