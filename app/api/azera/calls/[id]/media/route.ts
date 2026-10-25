import { NextResponse } from "next/server";
import { TrackType } from "@livekit/protocol";
import { getSession, hasPermission } from "@/lib/admin-auth";
import {
  mediaApi,
  mediaAudit,
  mediaConfig,
  mediaToken,
  whisperRoom,
} from "@/lib/azera-media";
import { supabase } from "@/lib/supabase";
import { notifyAdminUser } from "@/lib/admin-notifications";

type Context = { params: Promise<{ id: string }> };
const jsonError = (error: string, status: number) =>
  NextResponse.json({ error }, { status });

export async function POST(request: Request, context: Context) {
  const session = await getSession();
  if (!session || !hasPermission(session.role, "azera"))
    return jsonError("Forbidden", 403);
  try {
    const { id } = await context.params;
    const { action, userId } = await request.json();
    const { data: call, error } = await supabase
      .from("azera_calls")
      .select("*")
      .eq("id", id)
      .eq("sip_provider", "livekit")
      .maybeSingle();
    if (error || !call || !call.webrtc_room)
      return jsonError("Media call not found", 404);
    const owner = call.agent_user_id === session.userId;
    const invited =
      call.transfer_to_user_id === session.userId &&
      Date.parse(call.transfer_expires_at || "") > Date.now();
    const supervisor = session.role === "Admin";
    if (!owner && !invited && !supervisor)
      return jsonError("This call is not assigned to you", 403);
    if (!["ringing", "active"].includes(call.status))
      return jsonError("This call has ended", 409);
    if (call.media_control_claim)
      return jsonError(
        "Another call control is in progress. Please retry shortly.",
        409,
      );
    const settings = await mediaConfig(),
      api = mediaApi(settings);
    const identity = `agent-${session.userId}`;

    if (["end", "hold", "resume"].includes(action)) {
      if (!owner)
        return jsonError("Only the current agent can control this call", 403);
      if (
        action !== "end" &&
        (call.status !== "active" || call.transfer_to_user_id)
      )
        return jsonError(
          "Finish or cancel the transfer before changing hold",
          409,
        );
      const claim = crypto.randomUUID();
      const { data: locked, error: lockError } = await supabase
        .from("azera_calls")
        .update({ media_control_claim: claim })
        .eq("id", id)
        .eq("agent_user_id", session.userId)
        .eq("status", call.status)
        .is("media_control_claim", null)
        .select("id")
        .maybeSingle();
      if (lockError || !locked)
        return jsonError(
          "Call ownership changed. Refresh before trying again.",
          409,
        );
      try {
        await mediaAudit(id, session.userId, `call_${action}_requested`);
        if (action === "end") {
          try {
            await api.room.deleteRoom(call.webrtc_room);
          } catch (error) {
            if (!(
              error &&
              typeof error === "object" &&
              "code" in error &&
              error.code === "not_found"
            ))
              throw error;
          }
          await api.room
            .deleteRoom(whisperRoom(id, session.userId))
            .catch(() => {});
        } else {
          await api.room.updateParticipant(call.webrtc_room, `phone-${id}`, {
            permission: {
              canPublish: action === "resume",
              canSubscribe: action === "resume",
              canPublishData: false,
            },
          });
        }
        const { error: updateError } = await supabase
          .from("azera_calls")
          .update(
            action === "end"
              ? {
                  status: "ended",
                  ended_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                  media_control_claim: null,
                  transfer_to_user_id: null,
                  transfer_expires_at: null,
                  duration_seconds: call.answered_at
                    ? Math.max(
                        0,
                        Math.floor(
                          (Date.now() - Date.parse(call.answered_at)) / 1000,
                        ),
                      )
                    : 0,
                }
              : {
                  held_at: action === "hold" ? new Date().toISOString() : null,
                  media_control_claim: null,
                },
          )
          .eq("id", id)
          .eq("media_control_claim", claim);
        if (updateError)
          throw new Error(
            "Provider control succeeded, but history could not be saved. Refresh before retrying.",
          );
        return NextResponse.json({
          status: action === "end" ? "ended" : "active",
          held: action === "hold",
        });
      } finally {
        await supabase
          .from("azera_calls")
          .update({ media_control_claim: null })
          .eq("id", id)
          .eq("media_control_claim", claim);
      }
    }

    if (action === "join") {
      if (!owner && !invited)
        return jsonError("Use the supervisor controls to join this call", 403);
      await mediaAudit(
        id,
        session.userId,
        invited ? "transfer_join_requested" : "agent_join_requested",
      );
      return NextResponse.json({
        id,
        url: settings.publicUrl,
        room: call.webrtc_room,
        token: await mediaToken(
          settings,
          call.webrtc_room,
          identity,
          session.name,
          true,
        ),
        invited,
      });
    }
    if (["listen", "whisper", "barge"].includes(action)) {
      if (!supervisor || owner)
        return jsonError("Supervisor permission required", 403);
      if (call.status !== "active")
        return jsonError("Wait for the call to connect", 409);
      if (action === "whisper" && !call.agent_user_id)
        return jsonError("No human agent is connected to coach", 409);
      // A whisper uses a separate room. No customer ever receives a token for
      // it. Listening cannot publish into the customer room, even with a
      // modified browser; the signed grant denies publication.
      await mediaAudit(id, session.userId, `supervisor_${action}`, {
        agent_user_id: call.agent_user_id,
      });
      const supervisorIdentity = `supervisor-${session.userId}`;
      const privateRoom =
        action === "whisper" ? whisperRoom(id, call.agent_user_id) : null;
      if (privateRoom)
        await api.room.createRoom({
          name: privateRoom,
          maxParticipants: 3,
          emptyTimeout: 30,
          departureTimeout: 5,
        });
      return NextResponse.json({
        id,
        url: settings.publicUrl,
        room: call.webrtc_room,
        token: await mediaToken(
          settings,
          call.webrtc_room,
          supervisorIdentity,
          session.name,
          action === "barge",
        ),
        ...(privateRoom
          ? {
              privateRoom,
              privateToken: await mediaToken(
                settings,
                privateRoom,
                supervisorIdentity,
                session.name,
                true,
              ),
            }
          : {}),
      });
    }
    if (action === "coach_audio") {
      if (!owner)
        return jsonError(
          "Only the current agent can receive private coaching",
          403,
        );
      const room = whisperRoom(id, session.userId);
      return NextResponse.json({
        url: settings.publicUrl,
        room,
        token: await mediaToken(settings, room, identity, session.name, false),
      });
    }
    if (action === "invite") {
      if (!owner || call.status !== "active")
        return jsonError(
          "Only the active call’s agent can invite a transfer",
          403,
        );
      if (call.held_at)
        return jsonError(
          "Resume the caller before inviting another agent",
          409,
        );
      if (
        typeof userId !== "string" ||
        !/^[a-f0-9-]{36}$/i.test(userId) ||
        userId === session.userId
      )
        return jsonError("Choose another available agent", 400);
      const { data: conversation } = await supabase
        .from("azera_conversations")
        .select("queue")
        .eq("id", call.conversation_id)
        .maybeSingle();
      const { data: presence } = await supabase
        .from("azera_agent_presence")
        .select("user_id,users!inner(role,status)")
        .eq("user_id", userId)
        .eq("is_online", true)
        .gte("last_seen_at", new Date(Date.now() - 90_000).toISOString())
        .contains("queues", [conversation?.queue || "customer_support"])
        .eq("users.status", "ACTIVE")
        .in("users.role", ["Admin", "Sales", "Customer Care", "Tech"])
        .maybeSingle();
      if (!presence)
        return jsonError(
          "That agent is offline or does not cover this queue",
          409,
        );
      const { data: busy } = await supabase
        .from("azera_calls")
        .select("id")
        .eq("agent_user_id", userId)
        .in("status", ["ringing", "active"])
        .limit(1);
      if (busy?.length)
        return jsonError("That agent is already on a call", 409);
      await mediaAudit(id, session.userId, "transfer_invited", {
        target_user_id: userId,
      });
      const { error: updateError } = await supabase
        .from("azera_calls")
        .update({
          transfer_to_user_id: userId,
          transfer_expires_at: new Date(Date.now() + 60_000).toISOString(),
        })
        .eq("id", id)
        .eq("agent_user_id", session.userId)
        .eq("status", "active");
      if (updateError) throw new Error("Could not invite the agent");
      await notifyAdminUser({
        admin_user_id: userId,
        type: "OMNICHANNEL_INBOUND",
        title: "Incoming call transfer",
        message: `${session.name} would like to hand over a connected call. Open the live call workspace to accept.`,
        deep_link: "/admin/azera/calls",
        source_type: "azera_call",
        source_id: id,
        actor_admin_user_id: session.userId,
      });
      return NextResponse.json({
        status: "invited",
        message: "Stay on the call until the other agent accepts.",
      });
    }
    if (action === "accept") {
      if (!invited)
        return jsonError("This transfer invitation has expired", 409);
      const participants = await api.room.listParticipants(call.webrtc_room);
      if (
        !participants.some(
          (p) =>
            p.identity === identity &&
            p.tracks.some((t) => t.type === TrackType.AUDIO && !t.muted),
        )
      )
        return jsonError("Connect your microphone before accepting", 409);
      await mediaAudit(id, session.userId, "transfer_accept_requested");
      const { data: accepted, error: claimError } = await supabase.rpc(
        "azera_accept_media_transfer",
        { p_call_id: id, p_agent_id: session.userId },
      );
      if (claimError || !accepted)
        return jsonError(
          "The transfer could not be claimed. The original agent remains connected.",
          409,
        );
      // Disable stale-owner audio before removing them. Failure to remove does
      // not undo an accepted transfer; it is reported for supervised recovery.
      let cleanupWarning = false;
      if (call.agent_user_id) {
        try {
          await api.room.updateParticipant(
            call.webrtc_room,
            `agent-${call.agent_user_id}`,
            {
              permission: {
                canPublish: false,
                canSubscribe: false,
                canPublishData: false,
              },
            },
          );
          await api.room.removeParticipant(
            call.webrtc_room,
            `agent-${call.agent_user_id}`,
          );
        } catch {
          cleanupWarning = true;
        }
        await api.room
          .deleteRoom(whisperRoom(id, call.agent_user_id))
          .catch(() => {});
      }
      return NextResponse.json({
        status: "accepted",
        ...(cleanupWarning
          ? {
              warning:
                "Transfer accepted; check that the former agent has left the call.",
            }
          : {}),
      });
    }
    if (["cancel", "decline"].includes(action)) {
      if (!(action === "cancel" ? owner : invited))
        return jsonError("Not authorised for this transfer", 403);
      await mediaAudit(id, session.userId, `transfer_${action}`);
      const { error: updateError } = await supabase
        .from("azera_calls")
        .update({ transfer_to_user_id: null, transfer_expires_at: null })
        .eq("id", id)
        .eq("transfer_to_user_id", call.transfer_to_user_id);
      if (updateError) throw new Error("Could not update the transfer");
      if (call.transfer_to_user_id)
        await api.room
          .removeParticipant(
            call.webrtc_room,
            `agent-${call.transfer_to_user_id}`,
          )
          .catch(() => {});
      return NextResponse.json({ status: "cancelled" });
    }
    return jsonError("Unsupported call control", 400);
  } catch (error) {
    return jsonError(
      error instanceof Error
        ? error.message
        : "Call control is temporarily unavailable",
      503,
    );
  }
}
