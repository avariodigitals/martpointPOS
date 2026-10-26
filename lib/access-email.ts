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
  return note?.trim() ? `${message.trim()}\n\n${note.trim()}` : message
}
