/* ───────────────────────────  Creator Network constants  ───────────────────────────
 * Pure constants + client-safe types — NO server imports here, so this file
 * can be bundled into public/client components (apply form, portal UI).
 * lib/creators.ts re-exports everything.
 */

export const CREATOR_APPLICATION_STATUSES = [
  "DRAFT",
  "SUBMITTED",
  "AI_REVIEWED",
  "MANUAL_REVIEW",
  "INTERVIEW_REQUESTED",
  "INTERVIEW_SCHEDULED",
  "APPROVED",
  "WAITLISTED",
  "REJECTED",
  "SUSPENDED",
] as const
export type CreatorApplicationStatus = (typeof CREATOR_APPLICATION_STATUSES)[number]

export const CREATOR_APPLICATION_STATUS_LABELS: Record<CreatorApplicationStatus, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  AI_REVIEWED: "AI Reviewed",
  MANUAL_REVIEW: "Manual Review",
  INTERVIEW_REQUESTED: "Interview Requested",
  INTERVIEW_SCHEDULED: "Interview Scheduled",
  APPROVED: "Approved",
  WAITLISTED: "Waitlisted",
  REJECTED: "Rejected",
  SUSPENDED: "Suspended",
}

export const CREATOR_APPLICATION_STATUS_COLORS: Record<CreatorApplicationStatus, string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  SUBMITTED: "bg-blue-100 text-blue-700",
  AI_REVIEWED: "bg-indigo-100 text-indigo-700",
  MANUAL_REVIEW: "bg-amber-100 text-amber-700",
  INTERVIEW_REQUESTED: "bg-purple-100 text-purple-700",
  INTERVIEW_SCHEDULED: "bg-purple-100 text-purple-800",
  APPROVED: "bg-green-100 text-green-700",
  WAITLISTED: "bg-yellow-100 text-yellow-800",
  REJECTED: "bg-red-100 text-red-700",
  SUSPENDED: "bg-red-100 text-red-800",
}

/** Applicant-facing label — never exposes internal workflow detail. */
export function publicCreatorApplicationStatus(status: CreatorApplicationStatus): string {
  switch (status) {
    case "SUBMITTED":
    case "AI_REVIEWED":
    case "MANUAL_REVIEW":
      return "Under review"
    case "INTERVIEW_REQUESTED":
      return "Interview requested — check your email"
    case "INTERVIEW_SCHEDULED":
      return "Interview scheduled"
    case "APPROVED":
      return "Approved — welcome to the Creator Network"
    case "WAITLISTED":
      return "Waitlisted"
    case "REJECTED":
      return "Not accepted at this time"
    case "SUSPENDED":
      return "On hold"
    default:
      return "Received"
  }
}

export const CREATOR_STATUSES = ["PENDING_ACTIVATION", "ACTIVE", "SUSPENDED", "REMOVED"] as const
export type CreatorStatus = (typeof CREATOR_STATUSES)[number]

export const CONTENT_CATEGORIES = [
  "Business / Entrepreneurship",
  "Retail",
  "Technology",
  "Finance",
  "Lifestyle",
  "Fashion",
  "Beauty",
  "Food",
  "Entertainment",
  "Education",
  "Local / Community",
  "Other",
] as const

export const CREATOR_PLATFORMS = [
  "TIKTOK",
  "INSTAGRAM",
  "YOUTUBE",
  "FACEBOOK",
  "X",
  "LINKEDIN",
  "OTHER",
] as const
export type CreatorPlatform = (typeof CREATOR_PLATFORMS)[number]

export const CREATOR_PLATFORM_LABELS: Record<string, string> = {
  TIKTOK: "TikTok",
  INSTAGRAM: "Instagram",
  YOUTUBE: "YouTube",
  FACEBOOK: "Facebook",
  X: "X (Twitter)",
  LINKEDIN: "LinkedIn",
  BLOG: "Blog / Website",
  OTHER: "Other",
}

export const EXPERIENCE_OPTIONS = ["<1", "1-2", "3-5", "5+"] as const

export const CHALLENGE_STATUSES = [
  "DRAFT",
  "SCHEDULED",
  "ACTIVE",
  "SUBMISSION_CLOSED",
  "JUDGING",
  "COMPLETED",
  "ARCHIVED",
] as const
export type ChallengeStatus = (typeof CHALLENGE_STATUSES)[number]

export const SUBMISSION_STATUSES = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "APPROVED",
  "NEEDS_CORRECTION",
  "REJECTED",
  "DISQUALIFIED",
] as const
export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number]

export const SUBMISSION_STATUS_LABELS: Record<SubmissionStatus, string> = {
  SUBMITTED: "Submitted",
  UNDER_REVIEW: "Under review",
  APPROVED: "Approved",
  NEEDS_CORRECTION: "Needs correction",
  REJECTED: "Rejected",
  DISQUALIFIED: "Disqualified",
}

export const REWARD_STATUSES = ["PENDING", "APPROVED", "PROCESSING", "PAID", "CANCELLED"] as const
export type RewardStatus = (typeof REWARD_STATUSES)[number]

export const RESOURCE_CATEGORIES = [
  "BRAND_ASSETS",
  "LOGOS",
  "PRODUCT_SCREENSHOTS",
  "PRODUCT_VIDEOS",
  "FEATURE_GUIDES",
  "INDUSTRY_GUIDES",
  "CONTENT_GUIDELINES",
  "CHALLENGE_BRIEFS",
  "TEMPLATES",
  "PRODUCT_DESCRIPTIONS",
  "FAQ",
  "OTHER",
] as const
export type ResourceCategory = (typeof RESOURCE_CATEGORIES)[number]

export const RESOURCE_CATEGORY_LABELS: Record<ResourceCategory, string> = {
  BRAND_ASSETS: "Brand Assets",
  LOGOS: "MartPoint Logos",
  PRODUCT_SCREENSHOTS: "Product Screenshots",
  PRODUCT_VIDEOS: "Product Videos",
  FEATURE_GUIDES: "Feature Guides",
  INDUSTRY_GUIDES: "Industry Guides",
  CONTENT_GUIDELINES: "Content Guidelines",
  CHALLENGE_BRIEFS: "Challenge Briefs",
  TEMPLATES: "Templates",
  PRODUCT_DESCRIPTIONS: "Approved Product Descriptions",
  FAQ: "FAQs",
  OTHER: "Other",
}

export const LEARNING_CATEGORIES = [
  "MARTPOINT_101",
  "SELLING_INVENTORY",
  "BUSINESS_MANAGEMENT",
  "DIGITAL_COMMERCE",
  "BUSINESS_TYPE",
  "GETTING_STARTED",
  "OTHER",
] as const
export type LearningCategory = (typeof LEARNING_CATEGORIES)[number]

export const LEARNING_CATEGORY_LABELS: Record<LearningCategory, string> = {
  MARTPOINT_101: "MartPoint 101",
  SELLING_INVENTORY: "Selling & Inventory",
  BUSINESS_MANAGEMENT: "Business Management",
  DIGITAL_COMMERCE: "Digital Commerce",
  BUSINESS_TYPE: "Business Types",
  GETTING_STARTED: "Getting Started",
  OTHER: "Other",
}

export const FLAG_TYPES = [
  "DUPLICATE_URL",
  "DUPLICATE_SUBMISSION",
  "REFERRAL_SPIKE",
  "CLICK_ANOMALY",
  "SELF_REFERRAL",
  "CONTENT_REMOVED",
  "SUSPICIOUS_ENGAGEMENT",
  "COPIED_CONTENT",
  "MISLEADING_CLAIM",
  "OTHER",
] as const
export type CreatorFlagType = (typeof FLAG_TYPES)[number]

export const PRIVACY_VERSION = "creator-network-v1"
