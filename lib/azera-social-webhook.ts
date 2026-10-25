import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { notifySupportAgents } from "@/lib/omnichannel-notifications";

export function validSocialSignature(
  raw: string,
  signature: string | null,
  secret: string,
) {
  if (!secret || !signature?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", secret).update(raw).digest("hex"),
    actual = signature.slice(7);
  return (
    actual.length === expected.length &&
    timingSafeEqual(Buffer.from(expected), Buffer.from(actual))
  );
}
export function validSharedWebhookSecret(
  provided: string | null,
  secret: string,
) {
  if (
    !secret ||
    !provided ||
    Buffer.byteLength(provided) !== Buffer.byteLength(secret)
  )
    return false;
  return timingSafeEqual(Buffer.from(provided), Buffer.from(secret));
}
export const socialTimestamp = (value: unknown, seconds = false) => {
  const n = Number(value) * (seconds ? 1000 : 1);
  return Number.isFinite(n) && n > 0 && n < 8.64e15
    ? new Date(n).toISOString()
    : new Date().toISOString();
};
export async function applyDeliveryReceipt(
  businessId: string,
  providerId: string,
  status: string,
  occurredAt: string,
) {
  if (!["sent", "delivered", "read", "failed"].includes(status)) return;
  const { error } = await supabase.from("azera_delivery_receipts").upsert(
    {
      business_id: businessId,
      provider_message_id: providerId,
      status,
      occurred_at: occurredAt,
    },
    { onConflict: "business_id,provider_message_id,status" },
  );
  if (error) throw new Error("Could not save provider receipt");
  await replayDeliveryReceipts(businessId, providerId);
}
export async function replayDeliveryReceipts(
  businessId: string,
  providerId: string,
) {
  const { data: receipts, error } = await supabase
    .from("azera_delivery_receipts")
    .select("status,occurred_at")
    .eq("business_id", businessId)
    .eq("provider_message_id", providerId);
  if (error) throw new Error("Could not load provider receipts");
  const rank: Record<string, number> = {
    sent: 1,
    failed: 2,
    delivered: 3,
    read: 4,
  };
  const best = (receipts || []).sort(
    (a, b) => rank[b.status] - rank[a.status],
  )[0];
  if (!best) return;
  const { data: conversations, error: lookupError } = await supabase
    .from("azera_conversations")
    .select("id")
    .eq("business_id", businessId);
  if (lookupError) throw new Error("Could not scope delivery receipt");
  if (!conversations?.length) return;
  const allowed =
    best.status === "read"
      ? ["pending", "accepted", "unknown", "sent", "failed", "delivered"]
      : best.status === "delivered"
        ? ["pending", "accepted", "unknown", "sent", "failed"]
        : best.status === "failed"
          ? ["pending", "accepted", "unknown", "sent"]
          : ["pending", "accepted", "unknown"];
  const { error: updateError } = await supabase
    .from("azera_messages")
    .update({
      delivery_status: best.status,
      delivery_updated_at: best.occurred_at,
      delivery_error:
        best.status === "failed"
          ? "The provider reported that delivery failed."
          : null,
    })
    .eq("provider_message_id", providerId)
    .in(
      "conversation_id",
      conversations.map((item) => item.id),
    )
    .in("delivery_status", allowed);
  if (updateError) throw new Error("Could not apply provider receipt");
}

export async function receiveSocialMessage(input: {
  businessId: string;
  channel: string;
  sender: string;
  providerId: string;
  text: string;
  name?: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}) {
  const externalId =
    input.channel === "whatsapp"
      ? input.sender
      : `${input.channel}:${input.sender}`;
  const initial = await supabase
    .from("azera_conversations")
    .select("*")
    .eq("business_id", input.businessId)
    .eq("channel", input.channel)
    .eq("external_id", externalId)
    .maybeSingle();
  let conversation = initial.data;
  const error = initial.error;
  if (error) throw new Error("Could not load conversation");
  if (!conversation) {
    const result = await supabase
      .from("azera_conversations")
      .insert({
        business_id: input.businessId,
        channel: input.channel,
        external_id: externalId,
        customer_name: input.name || input.sender,
        customer_phone: input.channel === "whatsapp" ? input.sender : null,
        status: "open",
        ai_enabled: false,
        waiting_for_agent: true,
        queue: "customer_support",
        last_message_at: input.timestamp,
      })
      .select()
      .single();
    if (result.error) {
      const existing = await supabase
        .from("azera_conversations")
        .select("*")
        .eq("business_id", input.businessId)
        .eq("channel", input.channel)
        .eq("external_id", externalId)
        .maybeSingle();
      if (!existing.data) throw new Error("Could not create conversation");
      conversation = existing.data;
    } else conversation = result.data;
  }
  const { error: messageError } = await supabase.from("azera_messages").insert({
    conversation_id: conversation.id,
    author_type: "customer",
    direction: "inbound",
    message: input.text,
    provider_message_id: input.providerId,
    delivery_status: "received",
    created_at: input.timestamp,
    metadata: input.metadata || {},
    message_type: input.metadata?.provider_media_id ? "attachment" : "text",
  });
  const duplicate = messageError?.code === "23505";
  if (messageError && !duplicate)
    throw new Error("Could not save incoming message");
  const { error: updateError } = await supabase
    .from("azera_conversations")
    .update({
      status: "open",
      waiting_for_agent: !conversation.assigned_admin_user_id,
      ai_enabled: false,
      last_message_at: input.timestamp,
      updated_at: new Date().toISOString(),
    })
    .eq("id", conversation.id)
    .lte("last_message_at", input.timestamp);
  if (updateError) throw new Error("Could not update conversation");
  await supabase.rpc("azera_assign_waiting_conversation", {
    p_conversation_id: conversation.id,
  });
  if (!duplicate)
    await notifySupportAgents({
      queue: "customer_support",
      title: `New ${input.channel === "whatsapp" ? "WhatsApp" : input.channel === "messenger" ? "Messenger" : "Instagram"} message`,
      message: `${input.name || "A customer"} sent a message.`,
      deepLink: `/admin/azera?conversation=${conversation.id}`,
      sourceId: conversation.id,
    });
}

export async function handleSocialWebhook(
  request: Request,
  channel: "whatsapp" | "messenger" | "instagram",
) {
  if (!isSupabaseConfigured())
    return NextResponse.json(
      { error: "Messaging storage unavailable" },
      { status: 503 },
    );
  const secret =
    process.env.META_APP_SECRET ||
    process.env[`${channel.toUpperCase()}_APP_SECRET`];
  if (!secret)
    return NextResponse.json(
      {
        error: "Configure the messaging app secret before receiving webhooks.",
      },
      { status: 503 },
    );
  const raw = await request.text();
  if (
    !validSocialSignature(
      raw,
      request.headers.get("x-hub-signature-256"),
      secret,
    )
  )
    return NextResponse.json(
      { error: "Invalid webhook signature" },
      { status: 401 },
    );
  try {
    const body = JSON.parse(raw);
    for (const entry of body.entry || []) {
      if (channel === "whatsapp") {
        for (const change of entry.changes || []) {
          const value = change.value || {},
            phoneId = value.metadata?.phone_number_id;
          if (!phoneId) continue;
          const { data: settings, error } = await supabase
            .from("azera_settings")
            .select("business_id")
            .eq("whatsapp_phone_number_id", phoneId)
            .maybeSingle();
          if (error || !settings?.business_id)
            throw new Error(
              "Map the WhatsApp phone number ID to a business in Azera Settings",
            );
          const names = new Map(
            (value.contacts || []).map(
              (contact: { wa_id: string; profile?: { name?: string } }) => [
                contact.wa_id,
                contact.profile?.name || "",
              ],
            ),
          );
          for (const receipt of value.statuses || [])
            await applyDeliveryReceipt(
              settings.business_id,
              receipt.id,
              receipt.status,
              socialTimestamp(receipt.timestamp, true),
            );
          for (const message of value.messages || []) {
            if (!message.id || !message.from) continue;
            const media = message[message.type];
            await receiveSocialMessage({
              businessId: settings.business_id,
              channel,
              sender: message.from,
              providerId: message.id,
              name: String(names.get(message.from) || ""),
              timestamp: socialTimestamp(message.timestamp, true),
              text:
                message.text?.body ||
                media?.caption ||
                `Customer sent ${message.type || "a message"}.`,
              metadata: media?.id
                ? {
                    provider_media_id: media.id,
                    provider_media_type: message.type,
                    provider_mime: media.mime_type || null,
                  }
                : {},
            });
          }
        }
      } else {
        const accountColumn =
          channel === "messenger"
            ? "messenger_page_id"
            : "instagram_account_id";
        const { data: settings, error } = await supabase
          .from("azera_settings")
          .select("business_id")
          .eq(accountColumn, String(entry.id))
          .maybeSingle();
        if (error || !settings?.business_id)
          throw new Error(
            "Map this social account to a business in Azera Settings",
          );
        for (const event of entry.messaging || []) {
          if (event.delivery?.mids)
            for (const mid of event.delivery.mids)
              await applyDeliveryReceipt(
                settings.business_id,
                mid,
                "delivered",
                socialTimestamp(event.timestamp),
              );
          if (event.read?.watermark && event.sender?.id) {
            const { data: conversation } = await supabase
              .from("azera_conversations")
              .select("id")
              .eq("business_id", settings.business_id)
              .eq("channel", channel)
              .eq("external_id", `${channel}:${event.sender.id}`)
              .maybeSingle();
            if (conversation)
              await supabase
                .from("azera_messages")
                .update({
                  delivery_status: "read",
                  delivery_updated_at: socialTimestamp(event.read.watermark),
                })
                .eq("conversation_id", conversation.id)
                .eq("direction", "outbound")
                .in("delivery_status", ["accepted", "sent", "delivered"])
                .lte("created_at", socialTimestamp(event.read.watermark));
          }
          if (
            !event.message ||
            event.message.is_echo ||
            !event.sender?.id ||
            !event.message.mid
          )
            continue;
          await receiveSocialMessage({
            businessId: settings.business_id,
            channel,
            sender: String(event.sender.id),
            providerId: event.message.mid,
            timestamp: socialTimestamp(event.timestamp),
            text:
              event.message.text ||
              `Customer sent ${event.message.attachments?.[0]?.type || "an attachment"}.`,
            metadata: event.message.attachments?.length
              ? { provider_attachments: event.message.attachments }
              : {},
          });
        }
      }
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      {
        error:
          "Could not process webhook. Verify account mapping and migration.",
      },
      { status: 503 },
    );
  }
}
export function socialVerify(
  request: Request,
  channel: "whatsapp" | "messenger" | "instagram",
) {
  const params = new URL(request.url).searchParams;
  const expected =
    process.env[
      channel === "whatsapp"
        ? "WHATSAPP_WEBHOOK_VERIFY_TOKEN"
        : `${channel.toUpperCase()}_VERIFY_TOKEN`
    ];
  return expected &&
    params.get("hub.mode") === "subscribe" &&
    params.get("hub.verify_token") === expected
    ? new NextResponse(params.get("hub.challenge") || "", { status: 200 })
    : NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
