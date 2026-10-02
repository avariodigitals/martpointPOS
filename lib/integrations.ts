export interface LiveKitSettings {
  serverUrl: string
  publicUrl: string
  apiKey: string
  apiSecret: string
  sipHostname: string
  sipUsername: string
  sipPassword: string
  sipNumber: string
  destinationCountry: string
}

export interface WhatsAppSettings {
  apiKey: string
  baseUrl: string
  webhookSecret: string
  phoneNumber: string
  /** Comma-separated intent keywords — an inbound message must contain one to
   *  create a lead. Empty = capture every new contact as a lead. */
  leadKeywords: string
}

export interface AdLeadsSettings {
  /** Shared secret for relayed posts (Make.com/Zapier) to /api/webhooks/*-leads */
  webhookSecret: string
  /** TikTok developer app secret — verifies the tiktok-signature header in native mode */
  tiktokAppSecret: string
  /** Meta webhook handshake token — any string you choose, entered in the Meta app config */
  metaVerifyToken: string
  /** Meta app secret — verifies the x-hub-signature-256 header */
  metaAppSecret: string
  /** Page or System-User token with leads_retrieval permission — fetches lead data by leadgen_id */
  metaPageAccessToken: string
}

export interface IntegrationSettings {
  livekit: LiveKitSettings
  whatsapp: WhatsAppSettings
  adLeads: AdLeadsSettings
}

export function getIntegrationDefaults(): IntegrationSettings {
  return {
    livekit: {
      serverUrl: process.env.LIVEKIT_URL || "",
      publicUrl: process.env.NEXT_PUBLIC_LIVEKIT_URL || "",
      apiKey: process.env.LIVEKIT_API_KEY || "",
      apiSecret: process.env.LIVEKIT_API_SECRET || "",
      sipHostname: process.env.LIVEKIT_SIP_TRUNK_HOSTNAME || "sip.za.didlogic.net",
      sipUsername: process.env.LIVEKIT_SIP_USERNAME || "",
      sipPassword: process.env.LIVEKIT_SIP_PASSWORD || "",
      sipNumber: process.env.LIVEKIT_SIP_NUMBER || "",
      destinationCountry: process.env.LIVEKIT_SIP_DESTINATION_COUNTRY || "NG",
    },
    whatsapp: {
      apiKey: process.env.DIALOG360_API_KEY || "",
      baseUrl: process.env.DIALOG360_BASE_URL || "https://waba-v2.360dialog.io",
      webhookSecret: process.env.DIALOG360_WEBHOOK_SECRET || "",
      phoneNumber: process.env.WHATSAPP_PHONE_NUMBER || "",
      leadKeywords:
        process.env.WHATSAPP_LEAD_KEYWORDS ||
        "demo,pricing,price,quote,cost,interested,buy,subscribe,pos,martpoint,inventory,point of sale,how much,sign up",
    },
    adLeads: {
      webhookSecret: process.env.LEADS_WEBHOOK_SECRET || "",
      tiktokAppSecret: process.env.TIKTOK_APP_SECRET || "",
      metaVerifyToken: process.env.META_VERIFY_TOKEN || "",
      metaAppSecret: process.env.META_APP_SECRET || "",
      metaPageAccessToken: process.env.META_PAGE_ACCESS_TOKEN || "",
    },
  }
}
