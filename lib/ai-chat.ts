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
  /** Maximum total time allowed for provider attempts, in milliseconds. */
  timeoutMs?: number
}

export interface AiChatResult {
  content: string
  model: string
  provider: string
}

export type AiChatDeltaHandler = (delta: string) => void | Promise<void>

interface ProviderConfig {
  name: string
  apiKey?: string
  baseUrl?: string
  model: string
}

function usableApiKey(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined
  const key = value.trim()
  if (!key || /your[-_ ]|example|placeholder|replace[-_ ]?me/i.test(key)) return undefined
  return key
}

const OPENAI_BASE_MODEL = "gpt-4o-mini"
const FALLBACK_BASE_URL = "https://api.x.ai/v1"
const FALLBACK_MODEL = "grok-4-fast-latest"

async function getStoredAiSettings(): Promise<{ openai?: Record<string, string>; xai?: Record<string, string> }> {
  try {
    const settings = await readSettings()
    return {
      openai: settings?.openai as Record<string, string> | undefined,
      xai: settings?.xai as Record<string, string> | undefined,
    }
  } catch {
    // ignore
  }
  return {}
}

function envProvider(keyName: string, name: string, baseUrl: string | undefined, model: string): ProviderConfig | null {
  const apiKey = usableApiKey(process.env[keyName])
  return apiKey ? { name, apiKey, baseUrl, model } : null
}

export function hasAnyAiKey(): boolean {
  return Boolean(
    usableApiKey(process.env.OPENAI_API_KEY) ||
    usableApiKey(process.env.XAI_API_KEY) ||
    usableApiKey(process.env.GROQ_API_KEY) ||
    usableApiKey(process.env.OPENROUTER_API_KEY) ||
    usableApiKey(process.env.MISTRAL_API_KEY) ||
    usableApiKey(process.env.GEMINI_API_KEY) ||
    usableApiKey(process.env.AI_API_KEY),
  )
}

async function getProviderCandidates(): Promise<ProviderConfig[]> {
  const stored = await getStoredAiSettings()
  const openaiKey = usableApiKey(stored.openai?.apiKey) || usableApiKey(process.env.OPENAI_API_KEY)
  const xaiKey = usableApiKey(stored.xai?.apiKey) || usableApiKey(process.env.XAI_API_KEY)
  const xaiBaseUrl = (stored.xai?.baseUrl || "").trim() || FALLBACK_BASE_URL
  const xaiModel = (stored.xai?.model || "").trim() || FALLBACK_MODEL

  const candidates = [
    openaiKey ? {
      name: "OpenAI",
      apiKey: openaiKey,
      baseUrl: (process.env.OPENAI_BASE_URL || "").trim() || undefined,
      model: (process.env.OPENAI_MODEL || "").trim() || OPENAI_BASE_MODEL,
    } : null,
    xaiKey ? { name: "XAI / fallback", apiKey: xaiKey, baseUrl: xaiBaseUrl, model: xaiModel } : null,
    envProvider("GROQ_API_KEY", "Groq", (process.env.GROQ_BASE_URL || "").trim() || "https://api.groq.com/openai/v1", (process.env.GROQ_MODEL || "").trim() || "llama-3.3-70b-versatile"),
    envProvider("OPENROUTER_API_KEY", "OpenRouter", (process.env.OPENROUTER_BASE_URL || "").trim() || "https://openrouter.ai/api/v1", (process.env.OPENROUTER_MODEL || "").trim() || "openai/gpt-4o-mini"),
    envProvider("MISTRAL_API_KEY", "Mistral", (process.env.MISTRAL_BASE_URL || "").trim() || "https://api.mistral.ai/v1", (process.env.MISTRAL_MODEL || "").trim() || "mistral-small-latest"),
    envProvider("GEMINI_API_KEY", "Gemini", (process.env.GEMINI_BASE_URL || "").trim() || "https://generativelanguage.googleapis.com/v1beta/openai", (process.env.GEMINI_MODEL || "").trim() || "gemini-2.0-flash"),
    envProvider("AI_API_KEY", "Configured AI provider", (process.env.AI_BASE_URL || "").trim() || undefined, (process.env.AI_MODEL || "").trim() || OPENAI_BASE_MODEL),
  ]

  return candidates.filter((candidate): candidate is ProviderConfig => Boolean(candidate))
}

/** Safe, non-secret provider status for admin diagnostics. */
export async function getAiProviderStatus(): Promise<{
  openaiConfigured: boolean
  fallbackConfigured: boolean
  configured: boolean
}> {
  const providers = await getProviderCandidates()
  return {
    openaiConfigured: providers.some((provider) => provider.name === "OpenAI"),
    fallbackConfigured: providers.some((provider) => provider.name !== "OpenAI"),
    configured: providers.length > 0,
  }
}

async function complete(
  provider: ProviderConfig,
  opts: AiChatOptions
): Promise<AiChatResult> {
  const OpenAI = (await import("openai")).default
  if (!provider.apiKey) throw new Error(`${provider.name} API key not configured`)

  const client = new OpenAI({
    apiKey: provider.apiKey,
    ...(provider.baseUrl ? { baseURL: provider.baseUrl } : {}),
    timeout: Math.max(1000, opts.timeoutMs ?? 12000),
  })
  const model = provider.model || opts.model || OPENAI_BASE_MODEL
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
    provider: provider.name,
  }
}

async function streamComplete(
  provider: ProviderConfig,
  opts: AiChatOptions,
  onDelta: AiChatDeltaHandler,
): Promise<AiChatResult> {
  const OpenAI = (await import("openai")).default
  if (!provider.apiKey) throw new Error(`${provider.name} API key not configured`)

  const client = new OpenAI({
    apiKey: provider.apiKey,
    ...(provider.baseUrl ? { baseURL: provider.baseUrl } : {}),
    timeout: Math.max(1000, opts.timeoutMs ?? 12000),
  })
  const model = provider.model || opts.model || OPENAI_BASE_MODEL
  const completion = await client.chat.completions.create({
    model,
    messages: opts.messages,
    temperature: opts.temperature ?? 0.3,
    max_tokens: opts.maxTokens ?? 1600,
    stream: true,
    ...(opts.json ? { response_format: { type: "json_object" as const } } : {}),
  })

  let content = ""
  for await (const chunk of completion) {
    const delta = chunk.choices[0]?.delta?.content || ""
    if (!delta) continue
    content += delta
    await onDelta(delta)
  }

  return {
    content: content.trim(),
    model,
    provider: provider.name,
  }
}

export async function aiChat(opts: AiChatOptions): Promise<AiChatResult> {
  const providers = await getProviderCandidates()
  if (!providers.length) throw new Error("No AI provider key configured")

  const totalTimeoutMs = Math.max(1000, opts.timeoutMs ?? 15000)
  const deadline = Date.now() + totalTimeoutMs
  const failures: string[] = []
  for (const provider of providers) {
    const remainingMs = deadline - Date.now()
    if (remainingMs <= 0) break
    try {
      return await complete(provider, { ...opts, timeoutMs: remainingMs })
    } catch (error) {
      failures.push(`${provider.name}: ${error instanceof Error ? error.message : "request failed"}`)
    }
  }

  throw new Error(failures.join("; ") || "AI response timed out")
}

/**
 * Stream the first configured provider that can answer. A provider is only
 * retried when it fails before emitting any content; once content is visible
 * to a visitor, switching providers could duplicate part of the answer.
 */
export async function aiChatStream(
  opts: AiChatOptions,
  onDelta: AiChatDeltaHandler,
): Promise<AiChatResult> {
  const providers = await getProviderCandidates()
  if (!providers.length) throw new Error("No AI provider key configured")

  const totalTimeoutMs = Math.max(1000, opts.timeoutMs ?? 15000)
  const deadline = Date.now() + totalTimeoutMs
  const failures: string[] = []
  let emittedContent = false

  for (const provider of providers) {
    const remainingMs = deadline - Date.now()
    if (remainingMs <= 0) break
    try {
      return await streamComplete(
        provider,
        { ...opts, timeoutMs: remainingMs },
        async (delta) => {
          emittedContent = true
          await onDelta(delta)
        },
      )
    } catch (error) {
      if (emittedContent) throw error
      failures.push(`${provider.name}: ${error instanceof Error ? error.message : "request failed"}`)
    }
  }

  throw new Error(failures.join("; ") || "AI response timed out")
}
