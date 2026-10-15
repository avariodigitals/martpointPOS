/* ────────────────────────  Shared AI chat with configurable fallback  ────────────────────────
 * One entry point for all LLM calls: try OpenAI first; on any failure (or missing
 * key) fall back to a second OpenAI-compatible provider configured in
 * Settings → OpenAI (default: Grok via xAI). Key, base URL and model all come
 * from settings, so the backup can be Grok, Groq, Xiaomi MiMo, OpenRouter, etc.
 * A missing OpenAI key alone is not an error when a fallback key exists.
 */

import { readSettings } from "./settings"

export interface AiChatMessage {
  role: "system" | "user" | "assistant"
  content: string
}

export interface AiChatOptions {
  model?: string
  messages: AiChatMessage[]
  temperature?: number
  maxTokens?: number
  json?: boolean
}

export interface AiChatResult {
  content: string
  model: string
  provider: "openai" | "fallback"
}

interface FallbackConfig {
  apiKey?: string
  baseUrl: string
  model: string
}

const OPENAI_BASE_MODEL = "gpt-4o-mini"
// Defaults keep the original Grok fallback working when only a key is set.
const FALLBACK_BASE_URL = "https://api.x.ai/v1"
const FALLBACK_MODEL = "grok-4-fast-latest"

async function getOpenAiKey(): Promise<string | undefined> {
  try {
    const settings = await readSettings()
    const openai = settings?.openai as Record<string, string> | undefined
    if (openai?.apiKey) return openai.apiKey
  } catch {
    // ignore
  }
  return process.env.OPENAI_API_KEY
}

async function getFallbackConfig(): Promise<FallbackConfig> {
  let apiKey: string | undefined
  let baseUrl = ""
  let model = ""
  try {
    const settings = await readSettings()
    const xai = settings?.xai as Record<string, string> | undefined
    apiKey = xai?.apiKey
    baseUrl = (xai?.baseUrl || "").trim()
    model = (xai?.model || "").trim()
  } catch {
    // ignore
  }
  return {
    apiKey: apiKey || process.env.XAI_API_KEY,
    baseUrl: baseUrl || FALLBACK_BASE_URL,
    model: model || FALLBACK_MODEL,
  }
}

export function hasAnyAiKey(): boolean {
  return Boolean(process.env.OPENAI_API_KEY || process.env.XAI_API_KEY)
}

async function complete(
  provider: "openai" | "fallback",
  opts: AiChatOptions
): Promise<AiChatResult> {
  const OpenAI = (await import("openai")).default
  const isFallback = provider === "fallback"
  const cfg = isFallback ? await getFallbackConfig() : null
  const apiKey = isFallback ? cfg!.apiKey : await getOpenAiKey()
  if (!apiKey) throw new Error(isFallback ? "Fallback AI key not configured" : "OpenAI API key not configured")

  // The fallback always runs on its own configured model — an OpenAI model
  // name from the caller would not exist on Grok/Groq/MiMo endpoints.
  const client = isFallback ? new OpenAI({ apiKey, baseURL: cfg!.baseUrl }) : new OpenAI({ apiKey })
  const model = isFallback ? cfg!.model : opts.model ?? OPENAI_BASE_MODEL
  const completion = await client.chat.completions.create({
    model,
    messages: opts.messages,
    temperature: opts.temperature ?? 0.3,
    max_tokens: opts.maxTokens ?? 1600,
    ...(opts.json ? { response_format: { type: "json_object" as const } } : {}),
  })
  return {
    content: completion.choices[0]?.message?.content?.trim() || "",
    model: completion.model || model,
    provider,
  }
}

export async function aiChat(opts: AiChatOptions): Promise<AiChatResult> {
  try {
    return await complete("openai", opts)
  } catch (err) {
    const openAiMessage = err instanceof Error ? err.message : "OpenAI request failed"
    const fallback = await getFallbackConfig()
    if (!fallback.apiKey) {
      // No fallback to lean on — but a missing key shouldn't masquerade as a request failure.
      if (openAiMessage.includes("not configured") && !hasAnyAiKey()) {
        throw new Error("No AI provider key configured (OpenAI or fallback)")
      }
      throw new Error(openAiMessage)
    }
    try {
      return await complete("fallback", opts)
    } catch (fbErr) {
      const fbMessage = fbErr instanceof Error ? fbErr.message : "Fallback AI request failed"
      throw new Error(`OpenAI failed (${openAiMessage}); fallback AI failed (${fbMessage})`)
    }
  }
}
