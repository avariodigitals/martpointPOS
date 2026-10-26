/** Client-safe target description. The server reloads creator/contact numbers. */
export type BrowserPhoneTarget =
  | { conversationId: string }
  | { creatorId: string }
  | { applicationId: string }
  | { phone: string; name?: string };

export type BrowserDialRequest = { target: BrowserPhoneTarget; name: string; phone: string };

export function normalizeDialNumber(raw: string): string | null {
  if (!/^[+\d\s().-]+$/.test(raw)) return null;
  let number = raw.replace(/[\s().-]/g, "");
  if (/^0\d{10}$/.test(number)) number = `+234${number.slice(1)}`;
  else if (number.startsWith("00")) number = `+${number.slice(2)}`;
  else if (/^[1-9]\d{7,14}$/.test(number)) number = `+${number}`;
  return /^\+[1-9]\d{7,14}$/.test(number) ? number : null;
}
