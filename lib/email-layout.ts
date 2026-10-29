export const EMAIL_LAYOUTS = ["normal", "branded"] as const
export type EmailLayout = (typeof EMAIL_LAYOUTS)[number]
