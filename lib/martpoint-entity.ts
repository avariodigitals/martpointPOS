import { readSettings } from "./settings"

/* ───────────────────────────  MartPoint contracting entity  ───────────────────────────
 * Single source for the MartPoint legal entity used across generated documents.
 * Resolution order: admin Settings → "MartPoint Legal Entity", then MARTPOINT_*
 * env vars, then hardcoded fallbacks.
 */

export interface MartPointEntity {
  legalName: string
  registrationNo: string
  registeredAddress: string
  noticeEmail: string
  signatoryName: string
  signatoryTitle: string
  signatoryEmail: string
  ownerName: string
  ownerEmail: string
  liabilityFloor: string
}

export async function getMartPointEntity(): Promise<MartPointEntity> {
  const stored = ((await readSettings())?.martpointEntity || {}) as Record<string, string>
  const pick = (key: string, env: string, fallback = "") =>
    (stored[key] || "").trim() || process.env[env] || fallback
  return {
    legalName: pick("legalName", "MARTPOINT_LEGAL_NAME", "MartPoint"),
    registrationNo: pick("registrationNo", "MARTPOINT_REGISTRATION_NO"),
    registeredAddress: pick("registeredAddress", "MARTPOINT_REGISTERED_ADDRESS"),
    noticeEmail: pick("noticeEmail", "MARTPOINT_NOTICE_EMAIL", "partners@martpoint.com.ng"),
    signatoryName: pick("signatoryName", "MARTPOINT_SIGNATORY_NAME"),
    signatoryTitle: pick("signatoryTitle", "MARTPOINT_SIGNATORY_TITLE"),
    signatoryEmail: pick("signatoryEmail", "MARTPOINT_SIGNATORY_EMAIL"),
    ownerName: pick("ownerName", "MARTPOINT_OWNER_NAME"),
    ownerEmail: pick("ownerEmail", "MARTPOINT_OWNER_EMAIL"),
    liabilityFloor: pick("liabilityFloor", "MARTPOINT_LIABILITY_FLOOR"),
  }
}
