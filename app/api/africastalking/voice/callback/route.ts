import { NextResponse } from "next/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import {
  recordingConsentAction,
  recordedDialAction,
} from "@/lib/africa-recording-actions";
import { importAfricaCallRecording } from "@/lib/africa-call-recording";
import { africaBrowserDestinations, browserCallerIdentity, preparedAfricaOutbound } from "@/lib/africa-browser-routing";
import { normalizeOutboundPhone } from "@/lib/azera-outbound";
import { departmentMenuAction, splitVoiceMenuGreeting } from "@/lib/africa-voice-menu";
import { POST as receiveVoiceEvent } from "@/app/api/africastalking/voice/events/route";
import {
  callbackSecretIsValid,
  finishAfricaWebhookEvent,
  getAfricaVoiceConfig,
  isVoiceBusinessOpen,
  normalizePhone,
  normalizeVoiceDestination,
  pick,
  readAfricaRequest,
  resolveAfricaBusinessId,
  storeAfricaWebhookEvent,
  voiceXml,
  xmlEscape,
} from "@/lib/africastalking";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const MENU_AFTER_CONSENT = "__department_menu__";

function isoOrNull(value: string): string | null {
  if (!value || value.toLowerCase() === "none") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function say(text: string): string {
  return `<Say>${xmlEscape(text)}</Say>`;
}

function sayOrPlay(text: string, audioUrl: string): string {
  return audioUrl ? `<Play url="${xmlEscape(audioUrl)}"/>` : say(text);
}

function callbackUrl(request: Request, path: string): string {
  const url = new URL(request.url);
  url.pathname = path;
  url.searchParams.delete("stage");
  url.searchParams.delete("menu-attempt");
  url.searchParams.delete("menu-timeout");
  url.searchParams.delete("consent-timeout");
  if (path.endsWith("/recording")) url.searchParams.set("kind", "voicemail");
  return url.toString();
}

function voicemailOrEnd(
  request: Request,
  config: Awaited<ReturnType<typeof getAfricaVoiceConfig>>,
  message: string,
  audioUrl = "",
): string[] {
  // Africa's Talking ends the call after the final Voice action. Hangup is not
  // a supported Voice action and causes the provider to abort the call.
  if (!config.voicemailEnabled) return [sayOrPlay(message, audioUrl)];
  return [
    sayOrPlay(message, audioUrl),
    `<Record maxLength="${config.voicemailMaxSeconds}" playBeep="true" callbackUrl="${xmlEscape(callbackUrl(request, "/api/africastalking/voice/recording"))}"/>`,
    say(
      "Thank you. Your message has been recorded and our team will follow up.",
    ),
  ];
}

async function recordAttempts(
  callId: string,
  businessId: string,
  departmentKey: string | null,
  destinations: string[],
  now: string,
) {
  if (!destinations.length) return;
  const parallel = hasBrowserDestination(destinations);
  await supabase.from("azera_call_attempts").insert(
    destinations.map((destination, index) => ({
      call_id: callId,
      business_id: businessId,
      department_key: departmentKey,
      destination,
      attempt_number: index + 1,
      // Parallel ring groups reserve every leg. Sequential fallbacks reserve
      // only the destination currently being tried.
      status: parallel || index === 0 ? "dialing" : "queued",
      started_at: now,
      created_at: now,
    })),
  );
}

function hasBrowserDestination(destinations: string[]) {
  return destinations.some((destination) => /^[a-zA-Z0-9_-]+\.mp_agent_[a-f0-9]+$/i.test(destination));
}

async function destinationsAreBusy(
  businessId: string,
  destinations: string[],
): Promise<boolean> {
  const routeDestinations = [
    ...new Set(destinations.map(normalizeVoiceDestination).filter(Boolean)),
  ];
  if (!routeDestinations.length) return false;

  const { data, error } = await supabase
    .from("azera_call_attempts")
    .select("destination")
    .eq("business_id", businessId)
    .in("status", ["dialing", "ringing", "answered"])
    .is("ended_at", null);

  if (error) {
    // A failed availability check must not prevent the provider from trying
    // the configured route.
    console.error("[Africa's Talking busy-route check error]", error);
    return false;
  }

  const busyDestinations = new Set(
    (data || [])
      .map((row) => normalizeVoiceDestination(row.destination))
      .filter(Boolean),
  );
  return routeDestinations.every((destination) =>
    busyDestinations.has(destination),
  );
}

async function markCallBusy(callId: string, now: string) {
  await supabase
    .from("azera_calls")
    .update({
      status: "busy",
      final_outcome: "busy",
      ended_at: now,
      updated_at: now,
    })
    .eq("id", callId);
  await supabase.from("azera_call_events").insert({
    call_id: callId,
    event_type: "busy",
    actor_type: "system",
    metadata: { reason: "All configured call destinations are busy" },
    created_at: now,
  });
}

function menuOptions(departments: Awaited<ReturnType<typeof getAfricaVoiceConfig>>["departments"]): string {
  const choices = departments.map((department) => `Press ${department.digit} for ${department.label}.`).join(" ");
  return `${choices} To hear these options again, press 9.`.trim();
}

function menuPrompt(
  greeting: string,
  departments: Awaited<ReturnType<typeof getAfricaVoiceConfig>>["departments"],
): string {
  // A legacy greeting may contain only one option (often “Press 1”). Never
  // treat that as a complete menu: derive every spoken choice from the active
  // department configuration and reserve 9 for replay.
  const introduction = splitVoiceMenuGreeting(greeting).introduction;
  return `${introduction} ${menuOptions(departments)}`.trim();
}

export async function POST(request: Request): Promise<Response> {
  if (!callbackSecretIsValid(request))
    return new NextResponse("Forbidden", { status: 403 });

  const eventRequest = request.clone();
  const { rawBody, payload } = await readAfricaRequest(request);
  const rawCaller = pick(payload, "callerNumber", "caller", "from");
  const requestUrl = new URL(request.url);
  const actionStage = requestUrl.searchParams.get("stage");
  const consentTimeout = requestUrl.searchParams.get("consent-timeout") === "1";
  const consentRetry = Math.min(2, Math.max(0, Number(requestUrl.searchParams.get("consent-retry")) || 0));
  const menuTimeout = actionStage === "department-menu" && requestUrl.searchParams.get("menu-timeout") === "1";
  const callbackMenuAttempt = requestUrl.searchParams.get("menu-attempt");
  const dtmfDigits = pick(payload, "dtmfDigits", "digits", "userInput", "input")
    .replace(/[^0-9*#]/g, "")
    .slice(0, 1);
  // AT also posts final events to the callback. A finished call must never
  // restart IVR or Dial (even when the separate Events URL is not configured).
  const providerState = pick(payload, "callSessionState", "status").toLowerCase();
  if (["0", "false"].includes(String(payload.isActive).toLowerCase()) ||
      ["completed", "ended", "failed", "busy", "notanswered", "rejected"].includes(providerState) ||
      (browserCallerIdentity(rawCaller) && !dtmfDigits && ["bridged", "answered", "active", "connected"].includes(providerState))) {
    const response = await receiveVoiceEvent(eventRequest);
    return response.ok ? voiceXml([]) : new NextResponse("Please retry", { status: 503 });
  }
  const caller = normalizePhone(
    pick(payload, "callerNumber", "caller", "from"),
  );
  const destination = normalizePhone(
    pick(payload, "destinationNumber", "destination", "to"),
  );
  const sessionId = pick(
    payload,
    "sessionId",
    "callSessionId",
    "call_sid",
    "call_id",
    "id",
  );
  const campaignRequest = pick(payload, "clientRequestId", "client_request_id");
  const campaignId = /^azera-campaign:[0-9a-f-]{36}$/i.test(campaignRequest);
  const campaignCall = !campaignId && sessionId
    ? await supabase.from("azera_calls").select("id").eq("sip_provider", "africas_talking_campaign").eq("sip_call_sid", sessionId).limit(1).maybeSingle()
    : null;
  if (campaignId || campaignCall?.data) {
    const { POST: handleCampaignVoice } = await import("@/app/api/africastalking/voice/campaign/route");
    return handleCampaignVoice(request);
  }
  if (browserCallerIdentity(rawCaller) || pick(payload, "clientDialedNumber")) {
    try {
      const dialled = normalizeOutboundPhone(pick(payload, "clientDialedNumber")) || "";
      const call = await preparedAfricaOutbound(rawCaller, dialled, sessionId);
      if (!call) return voiceXml([say("This call is not authorised. Please start the call again from MartPoint.")]);
      const event = await storeAfricaWebhookEvent({ product: "voice", endpoint: "voice/callback", request, rawBody, payload, businessId: call.business_id });
      await finishAfricaWebhookEvent(event, "processed");
      if (!["ringing", "active"].includes(call.status)) return voiceXml([]);
      // Exactly the stored contact number, never arbitrary caller input.
      return voiceXml([recordedDialAction([call.sip_to_number], call.sip_from_number, "", false)]);
    } catch {
      return new NextResponse("Please retry", { status: 503 });
    }
  }
  const businessId = await resolveAfricaBusinessId(destination);
  const webhookEventId = await storeAfricaWebhookEvent({
    product: "voice",
    endpoint: "voice/callback",
    request,
    rawBody,
    payload,
    businessId,
  });

  try {
    if (!sessionId || !businessId || !isSupabaseConfigured()) {
      await finishAfricaWebhookEvent(
        webhookEventId,
        sessionId ? "processed" : "failed",
        sessionId ? undefined : "Missing Africa's Talking sessionId",
      );
      return voiceXml([
        say(
          "Sorry, this call cannot be connected right now. Please try again later.",
        ),
      ]);
    }

    const now = new Date().toISOString();
    const startedAt =
      isoOrNull(pick(payload, "callStartTime", "started_at")) || now;
    const { data: existing, error: callReadError } = await supabase
      .from("azera_calls")
      .select(
        "id, status, menu_attempts, selected_department, recording_choice, recording_consent_at, recording_consent_requested_at",
      )
      .eq("business_id", businessId)
      .eq("sip_call_sid", sessionId)
      .maybeSingle();
    if (callReadError) throw new Error("Could not load call flow. Apply voice consent migration 139.");

    let callId = existing?.id as string | undefined;
    let menuAttempts = Number(existing?.menu_attempts || 0);
    if (!callId) {
      const { data: created, error } = await supabase
        .from("azera_calls")
        .insert({
          business_id: businessId,
          call_type: "sip",
          direction: "inbound",
          status: "ringing",
          customer_phone: caller || null,
          sip_provider: "africas_talking",
          sip_call_sid: sessionId,
          sip_from_number: destination || null,
          sip_to_number: caller || null,
          started_at: startedAt,
          created_at: now,
          updated_at: now,
        })
        .select("id, menu_attempts")
        .single();
      if (error || !created)
        throw new Error(error?.message || "Could not create inbound call");
      callId = created.id as string;
      menuAttempts = Number(created.menu_attempts || 0);
      await supabase.from("azera_call_events").insert({
        call_id: callId,
        event_type: "ringing",
        actor_type: "sip_provider",
        metadata: {
          provider: "africas_talking",
          callback_event_id: webhookEventId,
        },
        created_at: now,
      });
    }

    const config = await getAfricaVoiceConfig(businessId);
    const departments = config.departments.slice(0, 8);
    const menuParts = splitVoiceMenuGreeting(config.greeting);
    const optionsPrompt = menuOptions(departments);
    const menuText = config.recordCalls && existing?.recording_choice
      ? optionsPrompt : menuPrompt(config.greeting, departments);
    // Reserve every available browser agent in this queue. Browser agents and
    // configured phone/SIP fallbacks ring together; the first answer takes it.
    const withBrowser = async (targets: string[], department = "default") => {
      const browsers = await africaBrowserDestinations(callId!, businessId, department);
      if (!browsers.length) return targets;
      return [...browsers, ...targets.filter(target => !browsers.includes(target))];
    };
    const requestConsent = async (department: string, greeting: string[] = []) => {
      const { error } = await supabase.from("azera_calls")
        .update({ selected_department: department, recording_consent_requested_at: now, recording_notice: config.recordingNotice, updated_at: now })
        .eq("id", callId).is("recording_choice", null).is("recording_consent_requested_at", null);
      if (error) throw new Error("Could not save the pending recording choice");
      await finishAfricaWebhookEvent(webhookEventId, "processed");
      return voiceXml([...greeting, recordingConsentAction(request.url, config.recordingNotice)]);
    };
    const open = isVoiceBusinessOpen(
      config.timezone,
      config.weeklySchedule,
      config.closedDates,
    );
    const recordingUrl = pick(payload, "recordingUrl", "recording_url");
    if (recordingUrl && existing?.recording_choice === "accepted") {
      await importAfricaCallRecording(
        {
          id: callId,
          business_id: businessId,
          recording_choice: existing.recording_choice,
          recording_consent_at: existing.recording_consent_at,
        },
        recordingUrl,
        pick(payload, "recordingId", "recording_id") || sessionId,
        config.recordingRetentionDays,
      );
      await finishAfricaWebhookEvent(webhookEventId, "processed");
      return voiceXml([]);
    }
    if (
      existing &&
      ["ended", "failed", "missed", "busy"].includes(existing.status)
    ) {
      await finishAfricaWebhookEvent(webhookEventId, "processed");
      return voiceXml([]);
    }
    if (existing?.status === "active") {
      // A delayed GetDigits retry must never dial again after connection.
      if (!dtmfDigits && ["bridged", "answered", "active", "connected"].includes(providerState)) {
        const response = await receiveVoiceEvent(eventRequest);
        return response.ok ? voiceXml([]) : new NextResponse("Please retry", { status: 503 });
      }
      await finishAfricaWebhookEvent(webhookEventId, "processed");
      return voiceXml([]);
    }
    // An old menu action cannot become recording consent or replace a selected
    // route. Delayed callbacks from earlier prompt attempts must not advance it.
    if (actionStage === "department-menu" &&
        (existing?.selected_department || (callbackMenuAttempt !== null && Number(callbackMenuAttempt) !== menuAttempts))) {
      await finishAfricaWebhookEvent(webhookEventId, "processed");
      return voiceXml([]);
    }
    // The stored stage is authoritative even when the provider returns digit
    // callbacks to the number's default URL rather than the action URL.
    const awaitingConsent = Boolean(existing?.recording_consent_requested_at && !existing.recording_choice);
    // A replayed consent digit must never become a department choice, or reset
    // the menu after the caller already made their recording decision.
    if (actionStage === "recording-consent" && existing?.recording_choice && menuAttempts > 0 && !existing.selected_department) {
      await finishAfricaWebhookEvent(webhookEventId, "processed");
      return voiceXml([departmentMenuAction(request.url, optionsPrompt, "", menuAttempts)]);
    }
    const consentRoute = actionStage === "recording-consent" || awaitingConsent ||
      Boolean(existing?.recording_consent_requested_at && existing.recording_choice && existing.selected_department);
    if (consentRoute) {
      // Silence or an invalid key is not consent to record and must not silently
      // transfer the caller. Repeat the prompt once, then end without dialing.
      if (!existing?.recording_choice && (consentTimeout || !["1", "2"].includes(dtmfDigits))) {
        await finishAfricaWebhookEvent(webhookEventId, "processed");
        const nextRetry = consentTimeout ? consentRetry : consentRetry + 1;
        if (nextRetry < 2) {
          return voiceXml([
            say("Please choose an option to continue."),
            recordingConsentAction(request.url, config.recordingNotice, nextRetry),
          ]);
        }
        return voiceXml([
          say("We did not receive a valid response. This call will now end."),
        ]);
      }
      const pendingAge = existing?.recording_consent_requested_at
        ? Date.now() - Date.parse(existing.recording_consent_requested_at) : Infinity;
      if (awaitingConsent && !consentTimeout && actionStage !== "recording-consent" && !dtmfDigits && pendingAge < 8_000) {
        // A prompt-delivery retry must not erase a choice or prompt forever.
        await finishAfricaWebhookEvent(webhookEventId, "processed");
        return voiceXml([recordingConsentAction(request.url, config.recordingNotice)]);
      }
      let accepted =
        config.recordCalls &&
        (existing?.recording_choice
          ? existing.recording_choice === "accepted" &&
            Boolean(existing.recording_consent_at)
          : !consentTimeout && dtmfDigits === "1");
      const { data: savedConsent, error: consentError } = await supabase
        .from("azera_calls")
        .update({
          recording_choice: accepted ? "accepted" : "declined",
          recording_consent_at: accepted ? now : null,
          recording_notice: config.recordingNotice,
          updated_at: now,
        })
        .eq("id", callId)
        .is("recording_choice", null)
        .select("recording_choice,recording_consent_at")
        .maybeSingle();
      if (consentError) throw new Error("Could not store recording choice");
      if (savedConsent?.recording_choice) {
        accepted = config.recordCalls && savedConsent.recording_choice === "accepted" && Boolean(savedConsent.recording_consent_at);
      } else if (!existing?.recording_choice) {
        // Another callback may have decided first. Read its stored decision;
        // never start recording using a losing callback's unsaved press of 1.
        const { data: winner, error } = await supabase.from("azera_calls")
          .select("recording_choice,recording_consent_at").eq("id", callId).maybeSingle();
        if (error || !winner?.recording_choice) throw new Error("Recording choice could not be confirmed");
        accepted = config.recordCalls && winner.recording_choice === "accepted" && Boolean(winner.recording_consent_at);
      }
      const selected = existing?.selected_department;
      if (selected === MENU_AFTER_CONSENT) {
        // Consent is a distinct step. Its 1/2 is consumed here, not reused as
        // Sales/Support; the next callback starts the department selection.
        const { error } = await supabase.from("azera_calls")
          .update({ selected_department: null, menu_attempts: 1, updated_at: now }).eq("id", callId);
        if (error) throw new Error("Could not start the department menu");
        await finishAfricaWebhookEvent(webhookEventId, "processed");
        return voiceXml([departmentMenuAction(request.url, optionsPrompt, "", 1)]);
      }
      let targets =
        selected === "after-hours"
          ? await withBrowser([config.afterHoursDestination].filter(Boolean), "support")
          : selected && selected !== "default"
            ? departments.find((item) => item.key === selected)?.numbers || []
            : config.forwardNumbers;
      if (selected !== "after-hours") targets = await withBrowser(targets, selected || "default");
      if (!targets.length) {
        await finishAfricaWebhookEvent(webhookEventId, "processed");
        return voiceXml(
          voicemailOrEnd(request, config, config.noAnswerGreeting),
        );
      }
      await recordAttempts(callId, businessId, selected || null, targets, now);
      await finishAfricaWebhookEvent(webhookEventId, "processed");
      return voiceXml([
        sayOrPlay(config.connectingGreeting, config.connectingAudioUrl),
        recordedDialAction(
          targets,
          config.phoneNumber || destination,
          config.waitingAudioUrl,
          accepted,
          !hasBrowserDestination(targets),
        ),
      ]);
    }
    const dialAction = (targets: string[], callerId: string, audio: string) =>
      recordedDialAction(
        targets,
        callerId,
        audio,
        config.recordCalls &&
          existing?.recording_choice === "accepted" &&
          Boolean(existing.recording_consent_at),
        !hasBrowserDestination(targets),
      );
    const consentRequired = config.recordCalls && !existing?.recording_choice;

    // Once the working-hours menu has started, finish that journey even if the
    // clock crosses closing time while the caller is choosing a department.
    if (!open && menuAttempts === 0) {
      const afterHoursTargets = await withBrowser(
        [config.afterHoursDestination].filter(Boolean),
        "support",
      );
      if (afterHoursTargets.length) {
        if (consentRequired) {
          return requestConsent("after-hours", [sayOrPlay(config.afterHoursGreeting, config.afterHoursAudioUrl)]);
        }
        await recordAttempts(
          callId,
          businessId,
          "after-hours",
          afterHoursTargets,
          now,
        );
        await supabase
          .from("azera_calls")
          .update({ selected_department: "after-hours", updated_at: now })
          .eq("id", callId);
        await finishAfricaWebhookEvent(webhookEventId, "processed");
        return voiceXml([
          sayOrPlay(config.afterHoursGreeting, config.afterHoursAudioUrl),
          dialAction(
            afterHoursTargets,
            config.phoneNumber || destination,
            config.waitingAudioUrl,
          ),
        ]);
      }
      await finishAfricaWebhookEvent(webhookEventId, "processed");
      return voiceXml(
        voicemailOrEnd(
          request,
          config,
          config.afterHoursGreeting,
          config.afterHoursAudioUrl,
        ),
      );
    }

    // A browser-only default route is valid even with no forwarding numbers.
    const defaultTargets = !config.menuEnabled ? await withBrowser(config.forwardNumbers) : config.forwardNumbers;
    const hasConfiguredRoute = defaultTargets.length > 0 || (config.menuEnabled && departments.length > 0);
    if (!hasConfiguredRoute) {
      await supabase
        .from("azera_calls")
        .update({
          status: "missed",
          final_outcome: "no_route",
          ended_at: now,
          updated_at: now,
        })
        .eq("id", callId);
      await supabase.from("azera_call_events").insert({
        call_id: callId,
        event_type: "missed",
        actor_type: "system",
        metadata: {
          reason: "No Africa's Talking forwarding number configured",
          callback_event_id: webhookEventId,
        },
        created_at: now,
      });
      await finishAfricaWebhookEvent(webhookEventId, "processed");
      return voiceXml(
        voicemailOrEnd(
          request,
          config,
          config.noAnswerGreeting,
          config.noAnswerAudioUrl,
        ),
      );
    }

    if (config.menuEnabled && departments.length && consentRequired && menuAttempts === 0 &&
        !existing?.selected_department && !dtmfDigits && actionStage !== "department-menu") {
      // Working-hours journey: welcome -> recording choice -> department ->
      // connection. A combined legacy welcome/menu is split at its options.
      return requestConsent(MENU_AFTER_CONSENT, [say(menuParts.introduction)]);
    }

    if (config.menuEnabled && departments.length) {
      const prompt = menuText;
      // A timeout Redirect can retain the previous request's digit in the body.
      const menuDigits = menuTimeout ? "" : dtmfDigits;
      const digit = Number(menuDigits);

      if (
        digit === 9 ||
        !menuDigits ||
        !departments.some((department) => department.digit === digit)
      ) {
        const firstPrompt = menuAttempts === 0 && actionStage !== "department-menu";
        const promptReplay = menuAttempts > 0 && !menuDigits && actionStage !== "department-menu";
        if (promptReplay) {
          await finishAfricaWebhookEvent(webhookEventId, "processed");
          return voiceXml([departmentMenuAction(request.url, prompt, config.recordCalls && existing?.recording_choice ? "" : config.greetingAudioUrl, menuAttempts)]);
        }
        const nextAttempts = menuAttempts + 1;
        // menu_attempts counts prompts delivered. The initial welcome is not a
        // failed attempt and does not consume the configured retry allowance.
        const canRetry = firstPrompt || (digit === 9 ? nextAttempts <= 4 : nextAttempts <= 1 + config.menuRetryLimit);
        if (canRetry) {
          await supabase
            .from("azera_calls")
            .update({ menu_attempts: nextAttempts, updated_at: now })
            .eq("id", callId);
          await finishAfricaWebhookEvent(webhookEventId, "processed");
          const retryPrefix = firstPrompt || digit === 9 ? "" : menuDigits ? "That is not a valid selection. " : "We did not receive a selection. ";
          // A configured audio file replaces only the menu itself, never the
          // retry explanation. Do not silently discard the prefix on audio.
          return voiceXml([
            ...(retryPrefix ? [say(retryPrefix)] : []),
            departmentMenuAction(request.url, prompt, config.recordCalls && existing?.recording_choice ? "" : config.greetingAudioUrl, nextAttempts),
          ]);
        }

        const retryTargets = await withBrowser(config.forwardNumbers);
        if (retryTargets.length) {
          if (consentRequired) return requestConsent("default");
          await recordAttempts(
            callId,
            businessId,
            null,
            retryTargets,
            now,
          );
          await supabase
            .from("azera_calls")
            .update({ selected_department: "default", updated_at: now })
            .eq("id", callId);
          await finishAfricaWebhookEvent(webhookEventId, "processed");
          return voiceXml([
            sayOrPlay(config.connectingGreeting, config.connectingAudioUrl),
            dialAction(
              retryTargets,
              config.phoneNumber || destination,
              config.waitingAudioUrl,
            ),
          ]);
        }
        await finishAfricaWebhookEvent(webhookEventId, "processed");
        return voiceXml(
          voicemailOrEnd(
            request,
            config,
            config.noAnswerGreeting,
            config.noAnswerAudioUrl,
          ),
        );
      }

      const department = departments.find((item) => item.digit === digit);
      if (department) {
        const targets = await withBrowser(department.numbers, `${department.key} ${department.label}`);
        if (await destinationsAreBusy(businessId, targets)) {
          await markCallBusy(callId, now);
          await finishAfricaWebhookEvent(webhookEventId, "processed");
          return voiceXml(voicemailOrEnd(request, config, config.busyGreeting));
        }
        if (consentRequired) {
          return requestConsent(department.key);
        }
        await recordAttempts(
          callId,
          businessId,
          department.key,
          targets,
          now,
        );
        await supabase
          .from("azera_calls")
          .update({ selected_department: department.key, updated_at: now })
          .eq("id", callId);
        await supabase.from("azera_call_events").insert({
          call_id: callId,
          event_type: "sip_webhook",
          actor_type: "system",
          metadata: {
            provider: "africas_talking",
            department: department.key,
            digit,
            label: department.label,
            callback_event_id: webhookEventId,
          },
          created_at: now,
        });
        await finishAfricaWebhookEvent(webhookEventId, "processed");
        return voiceXml([
          sayOrPlay(config.connectingGreeting, config.connectingAudioUrl),
          dialAction(
            targets,
            config.phoneNumber || destination,
            config.waitingAudioUrl,
          ),
        ]);
      }
    }

    if (await destinationsAreBusy(businessId, defaultTargets)) {
      await markCallBusy(callId, now);
      await finishAfricaWebhookEvent(webhookEventId, "processed");
      return voiceXml(voicemailOrEnd(request, config, config.busyGreeting));
    }

    if (consentRequired) {
      return requestConsent("default", [sayOrPlay(config.greeting, config.greetingAudioUrl)]);
    }
    await recordAttempts(callId, businessId, null, defaultTargets, now);
    await finishAfricaWebhookEvent(webhookEventId, "processed");
    const callerId = config.phoneNumber || destination;
    return voiceXml([
      sayOrPlay(config.greeting, config.greetingAudioUrl),
      sayOrPlay(config.connectingGreeting, config.connectingAudioUrl),
      dialAction(defaultTargets, callerId, config.waitingAudioUrl),
    ]);
  } catch (error) {
    console.error("[Africa's Talking voice callback error]", error);
    await finishAfricaWebhookEvent(
      webhookEventId,
      "failed",
      error instanceof Error ? error.message : "Voice callback failed",
    );
    return voiceXml([
      say("Sorry, we are unable to connect your call right now."),
    ]);
  }
}
