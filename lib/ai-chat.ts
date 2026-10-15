/* ───────────────────────────  Shared AI chat with Grok fallback  ───────────────────────────
 * One entry point for all LLM calls: try OpenAI first; on any failure (or missing
 * key) fall back to Grok via xAI's OpenAI-compatible endpoint.
 * Keys resolve from Settings → OpenAI, then env (OPENAI_API_KEY / XAI_API_KEY).
 * A missing OpenAI key alone is not an error when a Grok key exists.
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
  provider: "openai" | "grok"
}

const OPENAI_BASE_MODEL = "gpt-4o-mini"
const GROK_BASE_URL = "https://api.x.ai/v1"
const GROK_BASE_MODEL = "grok-4-fast-latest"

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

export async function getGrokKey(): Promise<string | undefined> {
  try {
    const settings = await readSettings()
    const xai = settings?.xai as Record<string, string> | undefined
    if (xai?.apiKey) return xai.apiKey
  } catch {
    // ignore
  }
  return process.env.XAI_API_KEY
}

export function hasAnyAiKey(): boolean {
  return Boolean(process.env.OPENAI_API_KEY || process.env.XAI_API_KEY)
}

async function complete(
  provider: "openai" | "grok",
  opts: AiChatOptions
): Promise<AiChatResult> {
  const OpenAI = (await import("openai")).default
  const isGrok = provider === "grok"
  const apiKey = isGrok ? await getGrokKey() : await getOpenAiKey()
  if (!apiKey) throw new Error(`${isGrok ? "Grok" : "OpenAI"} API key not configured`)

  const client = new OpenAI(isGrok ? { apiKey, baseURL: GROK_BASE_URL } : { apiKey })
  const model = opts.model ?? (isGrok ? GROK_BASE_MODEL : OPENAI_BASE_MODEL)
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
    if (!(await getGrokKey())) {
      // No Grok to fall back to — but a missing key shouldn't masquerade as a request failure.
      if (openAiMessage.includes("not configured") && !hasAnyAiKey()) {
        throw new Error("No AI provider key configured (OpenAI or Grok/xAI)")
      }
      throw new Error(openAiMessage)
    }
    try {
      return await complete("grok", opts)
    } catch (grokErr) {
      const grokMessage = grokErr instanceof Error ? grokErr.message : "Grok request failed"
      throw new Error(`OpenAI failed (${openAiMessage}); Grok fallback failed (${grokMessage})`)
    }
  }
}
