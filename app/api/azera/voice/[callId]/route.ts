import { NextResponse } from "next/server"
import { getSession, hasPermission } from "@/lib/admin-auth"
import type { SessionPayload, UserRole } from "@/lib/admin-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { getAiVoiceProvider } from "@/lib/ai-voice"

function ok<T>(data: T) {
  return NextResponse.json({ success: true, data })
}
function err(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status })
}

async function requireSession(): Promise<SessionPayload | null> {
  const session = await getSession()
  if (!session || !hasPermission(session.role as UserRole, "azera")) {
    return null
  }
  return session
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ callId: string }> }
) {
  const session = await requireSession()
  if (!session) return err("Forbidden", 403)

  if (!isSupabaseConfigured()) return err("Supabase not configured", 500)

  const { callId } = await params

  try {
    const formData = await request.formData()
    const audioFile = formData.get("audio") as File
    const transcript = formData.get("transcript") as string // optional STT text

    if (!audioFile && !transcript) {
      return err("Audio file or transcript is required")
    }

    // Get call details
    const { data: call, error: callError } = await supabase
      .from("azera_calls")
      .select("*")
      .eq("id", callId)
      .single()

    if (callError || !call) return err("Call not found", 404)

    // Get business settings for AI prompt
    const { data: settings } = await supabase
      .from("azera_settings")
      .select("*")
      .eq("business_id", call.business_id)
      .single()

    const providerId = String(settings?.ai_voice_provider || "openai")
    const provider = await getAiVoiceProvider(providerId)
    if (!provider) return err(`${providerId} is not configured for AI voice`, 503)

    // 1. Speech-to-Text via OpenAI Whisper (if audio provided)
    let customerText = transcript
    if (audioFile && !customerText) {
      try {
        const transcriptionForm = new FormData()
        transcriptionForm.append("file", audioFile)
        transcriptionForm.append("model", provider.sttModel)
        const whisperRes = await fetch(`${provider.baseUrl}/audio/transcriptions`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${provider.apiKey}`,
          },
          body: transcriptionForm,
        })

        if (!whisperRes.ok) {
          console.error("[Whisper] STT failed", await whisperRes.text())
        } else {
          const whisperData = await whisperRes.json()
          customerText = whisperData.text
        }
      } catch (e) {
        console.error("[Whisper] STT error", e)
      }
    }

    if (!customerText) {
      return err("Could not transcribe audio")
    }

    // Save customer's spoken message
    await supabase.from("azera_messages").insert({
      conversation_id: call.conversation_id,
      author_type: "customer",
      message: customerText,
      direction: "inbound",
      created_at: new Date().toISOString(),
    })

    // Update call status
    await supabase
      .from("azera_calls")
      .update({ last_message_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", callId)

    // 2. AI Brain via OpenAI GPT
    // Get knowledge base articles
    const { data: kb } = await supabase
      .from("azera_knowledge")
      .select("title, content, keywords")
      .eq("business_id", call.business_id)
      .eq("status", "published")
      .limit(100)

    // Build system prompt
    let systemPrompt = `You are Azera, an AI customer service assistant for a MartPoint business.
Answer the customer's question helpfully and briefly. Keep responses under 100 words.
If you don't know the answer, say so and offer to transfer to a human agent.
If the customer asks to speak to an agent, say "transfer_to_agent".`

    if (settings?.ai_prompt) {
      systemPrompt += `\n\nBusiness instructions: ${settings.ai_prompt}`
    }

    if (kb && kb.length) {
      systemPrompt += "\n\nReference knowledge:\n"
      for (const article of kb) {
        systemPrompt += `- ${article.title}: ${article.content}\n`
      }
    }

    const gptRes = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${provider.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: provider.chatModel,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: customerText },
        ],
        temperature: 0.3,
        max_tokens: 300,
      }),
    })

    if (!gptRes.ok) {
      console.error("[GPT] AI response failed", await gptRes.text())
      return err("AI response failed", 500)
    }

    const gptData = await gptRes.json()
    const aiText = gptData.choices[0]?.message?.content || ""

    // Check if customer wants transfer to agent
    const wantsTransfer =
      /transfer_to_agent|speak to (a|an|the) agent|human agent|real person|customer service/i.test(
        aiText
      ) || /agent|human|representative/i.test(customerText)

    let transferToAgent = false
    if (wantsTransfer) {
      transferToAgent = true
      await supabase
        .from("azera_calls")
        .update({ status: "waiting_agent", updated_at: new Date().toISOString() })
        .eq("id", callId)
    }

    // Save AI's spoken response
    const { data: aiMsg, error: aiMsgError } = await supabase
      .from("azera_messages")
      .insert({
        conversation_id: call.conversation_id,
        author_type: "ai",
        message: aiText,
        direction: "outbound",
        created_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (aiMsgError) {
      console.error("[AI] Save message error", aiMsgError)
    }

    // 3. Text-to-Speech via OpenAI TTS
    let audioUrl: string | null = null
    try {
      const ttsRes = await fetch(`${provider.baseUrl}/audio/speech`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${provider.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: provider.ttsModel,
          voice: settings?.ai_voice || "alloy",
          input: aiText,
        }),
      })

      if (ttsRes.ok) {
        const arrayBuffer = await ttsRes.arrayBuffer()
        const base64Audio = Buffer.from(arrayBuffer).toString("base64")
        audioUrl = `data:audio/mp3;base64,${base64Audio}`
      } else {
        console.error("[TTS] Failed", await ttsRes.text())
      }
    } catch (e) {
      console.error("[TTS] Error", e)
    }

    return ok({
      customer_transcript: customerText,
      ai_response: aiText,
      audio_url: audioUrl,
      transfer_to_agent: transferToAgent,
      message: aiMsg,
    })
  } catch (e) {
    console.error("[Voice] Error", e)
    return err(String(e), 500)
  }
}
