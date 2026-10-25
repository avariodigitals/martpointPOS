import { handleSocialWebhook, socialVerify } from "@/lib/azera-social-webhook"
export const GET = (request: Request) => socialVerify(request, "whatsapp")
export const POST = (request: Request) => handleSocialWebhook(request, "whatsapp")
