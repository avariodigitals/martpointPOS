import { handleSocialWebhook, socialVerify } from "@/lib/azera-social-webhook"
export const GET = (request: Request) => socialVerify(request, "messenger")
export const POST = (request: Request) => handleSocialWebhook(request, "messenger")
