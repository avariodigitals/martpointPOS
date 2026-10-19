export type PartnerType =
  | "REFERRAL" | "CHANNEL" | "IMPLEMENTATION" | "CHANNEL_IMPLEMENTATION" | "TECHNOLOGY" | "PAYMENT"

export const PARTNER_TYPE_LABELS: Record<PartnerType, string> = {
  REFERRAL: "Referral Partner",
  CHANNEL: "Channel Partner",
  IMPLEMENTATION: "Implementation Partner",
  CHANNEL_IMPLEMENTATION: "Channel + Implementation",
  TECHNOLOGY: "Technology Partner",
  PAYMENT: "Payment Partner",
}
