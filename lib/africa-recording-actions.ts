import { xmlEscape } from "@/lib/africastalking";

export function voicemailCallbackUrl(callback: string): string {
  const url = new URL(callback);
  url.pathname = "/api/africastalking/voice/recording";
  url.searchParams.delete("stage");
  url.searchParams.delete("menu-attempt");
  url.searchParams.delete("menu-timeout");
  url.searchParams.delete("consent-timeout");
  url.searchParams.set("kind", "voicemail");
  return url.toString();
}

export function voicemailActions(
  callback: string,
  message: string,
  audioUrl: string,
  maxSeconds: number,
): string[] {
  const greeting = audioUrl
    ? `<Play url="${xmlEscape(audioUrl)}"/>`
    : `<Say>${xmlEscape(message)}</Say>`;
  return [
    greeting,
    "<Say>Please leave your message after the tone. Press # when you are finished.</Say>",
    `<Record finishOnKey="#" maxLength="${maxSeconds}" playBeep="true" callbackUrl="${xmlEscape(voicemailCallbackUrl(callback))}"/>`,
    "<Say>Thank you. Your message has been recorded and our team will follow up.</Say>",
  ];
}

export function recordingNoticeAction(callback: string, notice: string) {
  notice = notice.replace(/^\s*Welcome to MartPoint[.!]?\s*(?:Thank you for calling[.!]?\s*)?/i, "").trim();
  if (/press\s+1\b/i.test(notice) && /press\s+2\b/i.test(notice))
    notice = "This call is being recorded for service quality and training.";
  const url = new URL(callback);
  url.pathname = "/api/africastalking/voice/consent";
  url.searchParams.set("stage", "recording-notice");
  url.searchParams.set("notice-complete", "1");
  url.searchParams.delete("consent-timeout");
  url.searchParams.delete("consent-retry");
  url.searchParams.delete("menu-timeout");
  url.searchParams.delete("menu-attempt");
  return `<Say>${xmlEscape(notice)}</Say><Redirect>${xmlEscape(url.toString())}</Redirect>`;
}
export function recordedDialAction(
  destinations: string[],
  callerId: string,
  waitingAudioUrl: string,
  record: boolean,
  sequential = true,
) {
  return `<Dial phoneNumbers="${xmlEscape(destinations.join(","))}" sequential="${sequential ? "true" : "false"}"${callerId ? ` callerId="${xmlEscape(callerId)}"` : ""}${waitingAudioUrl ? ` ringbackTone="${xmlEscape(waitingAudioUrl)}"` : ""}${record ? ' record="true"' : ""}/>`;
}
