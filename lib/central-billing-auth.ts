import crypto from "crypto"

const secret = () => process.env.CENTRAL_BILLING_API_SECRET || ""

export function centralSignature(timestamp: string, rawBody: string, path: string) {
  if (!secret()) throw new Error("Central billing API secret is not configured")
  return crypto.createHmac("sha256", secret()).update(`${timestamp}\n${path}\n${rawBody}`).digest("hex")
}

export function verifyCentralRequest(timestamp: string, rawBody: string, signature: string, path: string) {
  if (!secret() || !/^\d{10}$/.test(timestamp) || Math.abs(Date.now() / 1000 - Number(timestamp)) > 300 || !/^[a-f0-9]{64}$/i.test(signature)) return false
  const expected = Buffer.from(centralSignature(timestamp, rawBody, path), "hex")
  const actual = Buffer.from(signature, "hex")
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual)
}
