export type CommissionAttributionType =
  | "ORIGINATING"
  | "SALES"
  | "IMPLEMENTATION"
  | "RENEWAL"
  | "OTHER"

export type CommissionAttribution = {
  beneficiaryPartnerId: string
  attributionType: CommissionAttributionType
  reason: string
  originatingPartnerId?: string | null
  salesPartnerId?: string | null
  implementationPartnerId?: string | null
  commissionPlanId?: string | null
  businessId: string
  invoiceId?: string | null
  amountKobo: number
}

export function describeAttribution(a: CommissionAttribution): string {
  const plan = a.commissionPlanId ? `plan ${a.commissionPlanId.slice(0, 8)}` : "default plan"
  const relationship = a.attributionType.toLowerCase().replace("_", " ")
  return `Commission paid to ${a.beneficiaryPartnerId.slice(0, 8)} as ${relationship} partner on business ${a.businessId.slice(0, 8)} under ${plan}. ${a.reason}`
}
