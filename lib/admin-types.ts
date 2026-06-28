export type UserRole = "Admin" | "Finance" | "Digital Marketer" | "Sales" | "Tech" | "Editor"

export interface User {
  id: string
  username: string
  name: string
  passwordHash: string
  role: UserRole
  createdAt: string
}

export interface SessionPayload {
  userId: string
  username: string
  role: UserRole
  name: string
}

export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  Admin: ["dashboard", "seo", "blog", "faqs", "tracker", "analytics", "settings", "users", "leads", "finance", "onboarding"],
  Finance: ["dashboard", "finance", "tracker", "analytics", "leads", "onboarding"],
  "Digital Marketer": ["dashboard", "seo", "blog", "faqs", "tracker", "analytics", "leads", "onboarding"],
  Sales: ["tracker", "analytics", "leads", "finance", "onboarding"],
  Tech: ["settings", "seo", "blog", "faqs"],
  Editor: ["blog", "faqs"],
}

export function hasPermission(role: UserRole, page: string): boolean {
  return ROLE_PERMISSIONS[role]?.includes(page) ?? false
}
