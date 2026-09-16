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
}

export interface IntegrationSettings {
  livekit: LiveKitSettings
  whatsapp: WhatsAppSettings
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
    },
  }
}
