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

/** Update labelled values without discarding custom paragraphs in a resend. */
export function updateAccessMessageField(message: string, key: string, value: string, previous = "") {
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
