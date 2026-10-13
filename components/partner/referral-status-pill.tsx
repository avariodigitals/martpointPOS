const CLASSES: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  SUBMITTED: "bg-blue-50 text-blue-700",
  UNDER_REVIEW: "bg-blue-50 text-blue-700",
  INFORMATION_REQUIRED: "bg-amber-100 text-amber-800",
  ACCEPTED: "bg-teal-50 text-teal-700",
  QUALIFIED: "bg-teal-50 text-teal-700",
  CONVERTED_UNPAID: "bg-amber-50 text-amber-800",
  PAID_PENDING_ACTIVATION: "bg-indigo-50 text-indigo-700",
  ACTIVATED_HOLDING: "bg-indigo-50 text-indigo-700",
  COMMISSION_ELIGIBLE: "bg-purple-50 text-purple-700",
  APPROVED: "bg-purple-50 text-purple-700",
  PAID: "bg-green-100 text-green-700",
  DUPLICATE: "bg-red-50 text-red-700",
  REJECTED: "bg-red-50 text-red-700",
  LOST: "bg-gray-100 text-gray-600",
  EXPIRED: "bg-gray-100 text-gray-600",
}

const FALLBACK = "bg-gray-100 text-gray-700"

/**
 * Referral lifecycle chip. Labels arrive pre-localised from the server so the
 * portal never shows a raw status constant.
 */
export function ReferralStatusPill({ status, label }: { status: string; label?: string }) {
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${CLASSES[status] || FALLBACK}`}
    >
      {label || status}
    </span>
  )
}
