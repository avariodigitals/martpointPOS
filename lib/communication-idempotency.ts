import crypto from "crypto"
export function communicationRequestId(batchId: string, leadId: string) {
  const hash = crypto.createHash("sha256").update(`${batchId}:${leadId}`).digest()
  hash[6] = (hash[6] & 15) | 64; hash[8] = (hash[8] & 63) | 128
  const hex = hash.subarray(0, 16).toString("hex")
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
