import { NextResponse } from "next/server"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { aiChat, type AiChatMessage } from "@/lib/ai-chat"
import { readSettings } from "@/lib/settings"
import { notifySupportAgents } from "@/lib/omnichannel-notifications"

function ok<T>(data: T) {
  return NextResponse.json({ success: true, data })
}
function err(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status })
}

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return err("Supabase not configured", 500)
  }

  try {
    const body = await request.json()
    const {
      business_id,
      external_id,
      customer_name,
      source = "public_site",
      message,
    } = body

    if (!business_id || !external_id || !message) {
      return err("business_id, external_id and message are required")
    }

    // 1. Find or create the conversation
    let { data: conv } = await supabase
      .from("azera_conversations")
      .select("*")
      .eq("business_id", business_id)
      .eq("channel", "website")
      .eq("external_id", external_id)
      .maybeSingle()

    if (!conv) {
      const { data: created, error: ce } = await supabase
        .from("azera_conversations")
        .insert({
          business_id,
          channel: "website",
          source,
          external_id,
          customer_name,
          status: "open",
          ai_enabled: true,
          last_message_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single()
      if (ce) {
        console.error("[Azera chat create conv error]", ce)
        return err("Failed to start conversation", 500)
      }
      conv = created
    }

    // 2. Save the customer's inbound message
    const { data: custMsg, error: me } = await supabase
      .from("azera_messages")
      .insert({
        conversation_id: conv.id,
        author_type: "customer",
        message: message.trim(),
        direction: "inbound",
        created_at: new Date().toISOString(),
      })
      .select()
      .single()
    if (me) {
      console.error("[Azera chat save customer msg error]", me)
      return err("Failed to save message", 500)
    }

    // Update conversation timestamp
    await supabase
      .from("azera_conversations")
      .update({ last_message_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", conv.id)

    void notifySupportAgents({
      title: "New customer message",
      message: `${customer_name || "A customer"} sent a message via ${source === "retail_app" ? "the retail app" : "website chat"}.`,
      deepLink: `/admin/azera?conversation=${conv.id}`,
      sourceId: conv.id,
    })

    // 3. AI reply (if enabled)
    let aiReply: string | null = null
    if (conv.ai_enabled) {
      try {
        // Fetch knowledge articles for this business
        const { data: kb } = await supabase
          .from("azera_knowledge")
          .select("title, content, keywords")
          .eq("business_id", business_id)

        // Fetch widget settings for greeting/prompt
        const { data: settings } = await supabase
          .from("azera_settings")
          .select("ai_prompt, brand_color")
          .eq("business_id", business_id)
          .maybeSingle()

        const systemPrompt = buildSystemPrompt(settings, kb || [])
        const messages: AiChatMessage[] = [
          { role: "system", content: systemPrompt },
          { role: "user", content: message.trim() },
        ]

        const result = await aiChat({ messages, temperature: 0.3, maxTokens: 500 })
        aiReply = result.content || null
      } catch (aiErr) {
        console.error("[Azera chat AI error]", aiErr)
        // AI failure is non-fatal — we still return the customer's message
      }
    }

    // 4. Save AI reply if we got one
    let aiMsg: any = null
    if (aiReply) {
      const { data: created, error: ae } = await supabase
        .from("azera_messages")
        .insert({
          conversation_id: conv.id,
          author_type: "ai",
          message: aiReply,
          direction: "outbound",
          created_at: new Date().toISOString(),
        })
        .select()
        .single()
      if (!ae && created) {
        aiMsg = created
        await supabase
          .from("azera_conversations")
          .update({ last_message_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq("id", conv.id)
      }
    }

    return ok({
      conversation: { ...conv, last_message_at: new Date().toISOString() },
      customer_message: custMsg,
      ai_message: aiMsg,
    })
  } catch (err_) {
    console.error("[Azera chat error]", err_)
    return err("Failed to process chat", 500)
  }
}

function buildSystemPrompt(settings: any | null, kb: any[]): string {
  let p = "You are Azera, a helpful customer-service assistant for a MartPoint business. "
  p = "Answer in the business's own tone. Keep replies short and friendly. "
  p += "If you don't know the answer, say so and offer to have a human agent follow up. "

  if (settings?.ai_prompt) {
    p += `\nBusiness instructions: ${settings.ai_prompt}\n`
  }

  if (kb && kb.length) {
    p += "\nReference knowledge (paraphrase, do not dump verbatim):\n"
    for (const article of kb) {
      p += `\n### ${article.title}\n${article.content}\n`
    }
  }

  return p
}
