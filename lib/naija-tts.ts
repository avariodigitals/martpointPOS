import { supabase } from "@/lib/supabase"

export type NaijaLanguage = "en" | "ha" | "ig" | "yo"

export const NAIJA_VOICES: Record<NaijaLanguage, string[]> = {
  en: ["idera", "emma", "jude", "osagie", "tayo", "zainab", "joke", "regina", "remi", "umar", "chinenye", "onye"],
  ha: ["hausa_male2", "hausa_female1", "hausa_female2", "hausa_male1", "hausa_clear"],
  ig: ["igbo_female2", "igbo_male2", "igbo_female1"],
  yo: ["yoruba_male2", "yoruba_female2", "yoruba_female1", "yoruba_clear"],
}

const keyPrompts: Record<NaijaLanguage, string> = {
  en: "To arrange a follow-up with our team, press 1. To request a call back, press 2. To stop automated calls from MartPoint, press 3.",
  yo: "Láti ṣètò ìbánisọ̀rọ̀ pẹ̀lú ẹgbẹ́ wa, tẹ 1. Láti béèrè kí a tún pè yín, tẹ 2. Láti dá àwọn ìpè aládàáṣe MartPoint dúró, tẹ 3.",
  ig: "Ka hazie ka ndị otu anyị kpọtụrụ unu, pịa 1. Ka rịọ ka anyị kpọọ unu ọzọ, pịa 2. Ka kwụsị oku akpaka MartPoint, pịa 3.",
  ha: "Don shirya tattaunawa da tawagarmu, danna 1. Don neman a sake kiranku, danna 2. Don dakatar da kiran atomatik na MartPoint, danna 3.",
}

export function campaignSpeechText(script: string, language: NaijaLanguage) {
  return `${script.trim()} ${keyPrompts[language]}`.slice(0, 1000)
}

export function isNaijaTtsEnabled() {
  return Boolean(process.env.NAIJA_TTS_API_KEY)
}

export async function synthesizeCampaignAudio(input: {
  businessId: string
  campaignId: string
  recipientId: string
  language: NaijaLanguage
  voice: string
  text: string
}) {
  if (!isNaijaTtsEnabled()) throw new Error("Naija Speech API key is not configured")
  if (!NAIJA_VOICES[input.language]?.includes(input.voice)) throw new Error("Unsupported Naija Speech voice")
  if (!input.text.trim() || input.text.length > 1000) throw new Error("Campaign audio text is empty or exceeds the provider limit")

  const response = await fetch("https://asr.naijallm.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.NAIJA_TTS_API_KEY}`,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({ input: input.text, language: input.language, voice: input.voice, model: "naija-tts", response_format: "mp3" }),
    signal: AbortSignal.timeout(25_000),
  })
  if (!response.ok) throw new Error(`Naija Speech request failed (${response.status})`)
  const bytes = new Uint8Array(await response.arrayBuffer())
  if (!bytes.length || bytes.length > 5 * 1024 * 1024) throw new Error("Naija Speech returned invalid audio")

  const path = `${input.businessId}/${input.campaignId}/${input.recipientId}.mp3`
  const { error } = await supabase.storage.from("azera-campaign-audio").upload(path, bytes, {
    contentType: "audio/mpeg",
    upsert: true,
  })
  if (error) throw new Error("Could not store generated campaign audio")
  return path
}

export async function createCampaignAudioUrl(path: string) {
  const { data, error } = await supabase.storage.from("azera-campaign-audio").createSignedUrl(path, 60 * 60)
  if (error || !data?.signedUrl) throw new Error("Could not prepare campaign audio for the phone provider")
  return data.signedUrl
}

export async function removeCampaignAudio(path: string | null | undefined) {
  if (!path) return
  await supabase.storage.from("azera-campaign-audio").remove([path])
}
