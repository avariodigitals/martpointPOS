import { NextResponse } from "next/server";
import { getSession, hasPermission } from "@/lib/admin-auth";
import type { SessionPayload, UserRole } from "@/lib/admin-auth";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import {
  dispatchChannelText,
  socialChannel,
} from "@/lib/azera-channel-delivery";
import { replayDeliveryReceipts } from "@/lib/azera-social-webhook";

type ChatMessage = Record<string, unknown> & {
  attachment_path?: string | null;
};

async function requireSession(): Promise<SessionPayload | null> {
  const session = await getSession();
  if (!session || !hasPermission(session.role as UserRole, "azera")) {
    return null;
  }
  return session;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireSession();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ messages: [] });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.max(
    1,
    Math.min(Number(searchParams.get("limit")) || 50, 100),
  );

  try {
    const { data, error } = await supabase
      .from("azera_messages")
      .select("*")
      .eq("conversation_id", id)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("[Azera messages error]", error);
      return NextResponse.json(
        { error: "Failed to load messages" },
        { status: 500 },
      );
    }

    const messages = await Promise.all(
      (data || []).reverse().map(async (message: ChatMessage) => {
        if (!message.attachment_path) return message;
        const { data: signed } = await supabase.storage
          .from("azera-chat-attachments")
          .createSignedUrl(message.attachment_path, 3600);
        return { ...message, attachment_url: signed?.signedUrl || null };
      }),
    );

    return NextResponse.json(
      { messages },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    console.error("[Azera messages error]", err);
    return NextResponse.json(
      { error: "Failed to load messages" },
      { status: 500 },
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireSession();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Supabase not configured" },
      { status: 500 },
    );
  }

  try {
    const body = await request.json();
    const {
      message,
      message_type = "text",
      metadata = {},
      retry_message_id,
    } = body;

    if (
      !retry_message_id &&
      (typeof message !== "string" ||
        !message.trim() ||
        message.length > 10_000)
    ) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 },
      );
    }

    const { data: conv, error: convError } = await supabase
      .from("azera_conversations")
      .select("id,status,business_id,channel,external_id")
      .eq("id", id)
      .single();

    if (convError || !conv) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 },
      );
    }
    if (conv.status === "closed")
      return NextResponse.json(
        { error: "Reopen this conversation before replying." },
        { status: 409 },
      );
    let data;
    if (retry_message_id) {
      const { data: previous } = await supabase
        .from("azera_messages")
        .select("*")
        .eq("id", retry_message_id)
        .eq("conversation_id", id)
        .eq("author_type", "agent")
        .eq("direction", "outbound")
        .maybeSingle();
      if (!previous)
        return NextResponse.json(
          { error: "Message not found." },
          { status: 404 },
        );
      if (
        previous.delivery_status !== "failed" &&
        !(
          previous.delivery_status === "unknown" &&
          body.confirm_uncertain_retry === true
        )
      ) {
        return NextResponse.json(
          {
            error:
              "Only failed messages can be retried. An unknown result requires checking the provider inbox and explicit confirmation first.",
          },
          { status: 409 },
        );
      }
      const claimed = await supabase
        .from("azera_messages")
        .update({
          delivery_status: "pending",
          provider_message_id: null,
          delivery_error: null,
          delivery_updated_at: new Date().toISOString(),
          delivery_attempts: (previous.delivery_attempts || 0) + 1,
        })
        .eq("id", previous.id)
        .eq("delivery_status", previous.delivery_status)
        .select()
        .maybeSingle();
      if (claimed.error || !claimed.data)
        return NextResponse.json(
          { error: "This message is already being retried." },
          { status: 409 },
        );
      data = claimed.data;
    } else {
      const clientId =
        typeof metadata?.client_message_id === "string"
          ? metadata.client_message_id
          : null;
      if (clientId && !/^[A-Za-z0-9_-]{1,100}$/.test(clientId))
        return NextResponse.json(
          { error: "Invalid message reference." },
          { status: 400 },
        );
      if (clientId) {
        const { data: existing } = await supabase
          .from("azera_messages")
          .select("*")
          .eq("conversation_id", id)
          .eq("client_message_id", clientId)
          .maybeSingle();
        if (existing) return NextResponse.json({ message: existing });
      }

      const inserted = await supabase
        .from("azera_messages")
        .insert({
          conversation_id: id,
          author_type: "agent",
          author_id: session.userId,
          message: message.trim(),
          message_type:
            message_type === "file_request" ? "file_request" : "text",
          metadata: clientId ? { client_message_id: clientId } : {},
          client_message_id: clientId,
          delivery_status: socialChannel(conv.channel)
            ? "pending"
            : "not_required",
          delivery_attempts: 1,
          delivery_updated_at: new Date().toISOString(),
          direction: "outbound",
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (inserted.error || !inserted.data) {
        if (inserted.error?.code === "23505" && clientId) {
          const { data: existing } = await supabase
            .from("azera_messages")
            .select("*")
            .eq("conversation_id", id)
            .eq("client_message_id", clientId)
            .maybeSingle();
          if (existing) return NextResponse.json({ message: existing });
        }
        return NextResponse.json(
          { error: "Failed to send message" },
          { status: 500 },
        );
      }
      data = inserted.data;
    }
    const delivery = await dispatchChannelText(conv, data.message).catch(
      () => ({
        status: "unknown" as const,
        providerId: undefined,
        error:
          "The send could not be confirmed. Check the provider inbox before retrying.",
      }),
    );
    const deliveryUpdate = {
      delivery_status: delivery.status,
      provider_message_id: delivery.providerId || null,
      delivery_error: delivery.error || null,
      delivery_updated_at: new Date().toISOString(),
    };
    data = { ...data, ...deliveryUpdate };
    let saveFailed = false;
    try {
      const saved = await supabase
        .from("azera_messages")
        .update(deliveryUpdate)
        .eq("id", data.id);
      saveFailed = Boolean(saved.error);
    } catch {
      saveFailed = true;
    }
    if (saveFailed)
      return NextResponse.json(
        {
          message: { ...data, delivery_status: "unknown" },
          error:
            "The send result could not be saved. Check the provider inbox before retrying.",
        },
        { status: 502 },
      );
    // A secondary sync failure must not hide a persisted send and invite a
    // duplicate. Provider acceptance is distinct from delivery/read receipts.
    let syncFailed = false;
    if (delivery.providerId) {
      try {
        await replayDeliveryReceipts(conv.business_id, delivery.providerId);
      } catch {
        syncFailed = true;
      }
    }
    try {
      const summary = await supabase
        .from("azera_conversations")
        .update({
          last_message_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          waiting_for_agent: false,
          ai_enabled: false,
        })
        .eq("id", id);
      if (summary.error) syncFailed = true;
    } catch {
      syncFailed = true;
    }

    return NextResponse.json(
      {
        message: data,
        ...(delivery.error ? { error: delivery.error } : {}),
        ...(syncFailed
          ? {
              warning:
                "Message saved, but receipt or conversation updates are delayed. Check its delivery status; do not send it again.",
            }
          : {}),
      },
      { status: ["failed", "unknown"].includes(delivery.status) ? 502 : 200 },
    );
  } catch (err) {
    console.error("[Azera send message error]", err);
    return NextResponse.json(
      { error: "Failed to send message" },
      { status: 500 },
    );
  }
}
