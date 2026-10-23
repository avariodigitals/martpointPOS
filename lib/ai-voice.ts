import { readSettings } from "./settings"

export type AiVoiceProviderId = "openai" | "xai" | "groq" | "openrouter" | "mistral" | "gemini" | "custom"

export type AiVoiceProvider = {
  id: AiVoiceProviderId
  label: string
  apiKey: string
  baseUrl: string
  chatModel: string
  sttModel: string
  ttsModel: string
}

function usable(value: unknown): string {
  const text = String(value || "").trim()
  return !text || /your[-_ ]|example|placeholder|replace[-_ ]?me/i.test(text) ? "" : text
}

function baseUrl(value: unknown, fallback: string): string {
  return (usable(value) || fallback).replace(/\/$/, "")
}

export async function getAiVoiceProvider(providerId: string): Promise<AiVoiceProvider | null> {
  const stored = (await readSettings()) || {}
  const openai = (stored.openai as Record<string, unknown> | undefined) || {}
  const xai = (stored.xai as Record<string, unknown> | undefined) || {}
  const id = (providerId || "openai") as AiVoiceProviderId

  const configurations: Record<AiVoiceProviderId, AiVoiceProvider> = {
    openai: {
      id: "openai",
      label: "OpenAI",
      apiKey: usable(openai.apiKey) || usable(process.env.OPENAI_API_KEY),
      baseUrl: baseUrl(process.env.OPENAI_BASE_URL, "https://api.openai.com/v1"),
      chatModel: usable(process.env.OPENAI_MODEL) || "gpt-4o-mini",
      sttModel: usable(process.env.OPENAI_STT_MODEL) || "whisper-1",
      ttsModel: usable(process.env.OPENAI_TTS_MODEL) || "tts-1",
    },
    xai: {
      id: "xai",
      label: "xAI",
      apiKey: usable(xai.apiKey) || usable(process.env.XAI_API_KEY),
      baseUrl: baseUrl(xai.baseUrl || process.env.XAI_BASE_URL, "https://api.x.ai/v1"),
      chatModel: usable(xai.model) || usable(process.env.XAI_MODEL) || "grok-4-fast-latest",
      sttModel: usable(process.env.XAI_STT_MODEL) || "whisper-1",
      ttsModel: usable(process.env.XAI_TTS_MODEL) || "tts-1",
    },
    groq: {
      id: "groq",
      label: "Groq",
      apiKey: usable(process.env.GROQ_API_KEY),
      baseUrl: baseUrl(process.env.GROQ_BASE_URL, "https://api.groq.com/openai/v1"),
      chatModel: usable(process.env.GROQ_MODEL) || "llama-3.3-70b-versatile",
      sttModel: usable(process.env.GROQ_STT_MODEL) || "whisper-large-v3-turbo",
      ttsModel: usable(process.env.GROQ_TTS_MODEL) || "tts-1",
    },
    openrouter: {
      id: "openrouter",
      label: "OpenRouter",
      apiKey: usable(process.env.OPENROUTER_API_KEY),
      baseUrl: baseUrl(process.env.OPENROUTER_BASE_URL, "https://openrouter.ai/api/v1"),
      chatModel: usable(process.env.OPENROUTER_MODEL) || "openai/gpt-4o-mini",
      sttModel: usable(process.env.OPENROUTER_STT_MODEL) || "whisper-1",
      ttsModel: usable(process.env.OPENROUTER_TTS_MODEL) || "tts-1",
    },
    mistral: {
      id: "mistral",
      label: "Mistral",
      apiKey: usable(process.env.MISTRAL_API_KEY),
      baseUrl: baseUrl(process.env.MISTRAL_BASE_URL, "https://api.mistral.ai/v1"),
      chatModel: usable(process.env.MISTRAL_MODEL) || "mistral-small-latest",
      sttModel: usable(process.env.MISTRAL_STT_MODEL) || "whisper-1",
      ttsModel: usable(process.env.MISTRAL_TTS_MODEL) || "tts-1",
    },
    gemini: {
      id: "gemini",
      label: "Gemini",
      apiKey: usable(process.env.GEMINI_API_KEY),
      baseUrl: baseUrl(process.env.GEMINI_BASE_URL, "https://generativelanguage.googleapis.com/v1beta/openai"),
      chatModel: usable(process.env.GEMINI_MODEL) || "gemini-2.0-flash",
      sttModel: usable(process.env.GEMINI_STT_MODEL) || "whisper-1",
      ttsModel: usable(process.env.GEMINI_TTS_MODEL) || "tts-1",
    },
    custom: {
      id: "custom",
      label: "Custom OpenAI-compatible",
      apiKey: usable(process.env.AI_API_KEY),
      baseUrl: baseUrl(process.env.AI_BASE_URL, ""),
      chatModel: usable(process.env.AI_MODEL) || "gpt-4o-mini",
      sttModel: usable(process.env.AI_STT_MODEL) || "whisper-1",
      ttsModel: usable(process.env.AI_TTS_MODEL) || "tts-1",
    },
  }

  const provider = configurations[id] || configurations.openai
  if (!provider.apiKey || !provider.baseUrl) return null
  return provider
}

export function voiceProviderOptions(): Array<{ id: AiVoiceProviderId; label: string }> {
  return [
    { id: "openai", label: "OpenAI (speech + chat)" },
    { id: "groq", label: "Groq (OpenAI-compatible endpoint)" },
    { id: "gemini", label: "Gemini (OpenAI-compatible endpoint)" },
    { id: "mistral", label: "Mistral (OpenAI-compatible endpoint)" },
    { id: "openrouter", label: "OpenRouter (OpenAI-compatible endpoint)" },
    { id: "xai", label: "xAI (OpenAI-compatible endpoint)" },
    { id: "custom", label: "Custom OpenAI-compatible provider" },
  ]
}
