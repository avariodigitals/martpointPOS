/** Client-safe target description. The server reloads creator/contact numbers. */
export type BrowserPhoneTarget =
  | { conversationId: string }
  | { creatorId: string }
  | { applicationId: string }
  | { leadId: string }
  | { phone: string; name?: string }
  | { sipAddress: string; name?: string };

export type BrowserDialRequest = { target: BrowserPhoneTarget; name: string; phone: string };

export function normalizeDialNumber(raw: string): string | null {
  if (!/^[+\d\s().-]+$/.test(raw)) return null;
  let number = raw.replace(/[\s().-]/g, "");
  if (/^0\d{10}$/.test(number)) number = `+234${number.slice(1)}`;
  else if (number.startsWith("00")) number = `+${number.slice(2)}`;
  else if (/^[1-9]\d{7,14}$/.test(number)) number = `+${number}`;
  return /^\+[1-9]\d{7,14}$/.test(number) ? number : null;
}


/** Normalize a user-supplied SIP URI without accepting headers or URI parameters. */
export function normalizeSipAddress(raw: string): string | null {
  const value = raw.trim().replace(/^sip:/i, "")
  const match = value.match(/^([A-Za-z0-9_.!~*'()%+-]+)@((?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,})(?::(5060|5061|[1-9]\d{1,4}))?$/)
  if (!match) return null
  const port = match[3] ? `:${match[3]}` : ""
  return `sip:${match[1]}@${match[2].toLowerCase()}${port}`
}
