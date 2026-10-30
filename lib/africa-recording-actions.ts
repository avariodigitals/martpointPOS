import { xmlEscape } from "@/lib/africastalking";

export function recordingConsentAction(callback: string, notice: string, retry = 0) {
  // The call journey now plays the main welcome before this step. Older
  // settings included that same welcome in the consent notice as a workaround.
  notice = notice.replace(/^\s*Welcome to MartPoint[.!]?\s*(?:Thank you for calling[.!]?\s*)?/i, "").trim();
  if (!/press\s+1\b/i.test(notice) || !/press\s+2\b/i.test(notice))
    notice +=
      " Press 1 to agree to recording, or press 2 to continue without recording.";
  const url = new URL(callback);
  url.pathname = "/api/africastalking/voice/consent";
  url.searchParams.set("stage", "recording-consent");
  url.searchParams.set("consent-retry", String(Math.max(0, Math.min(2, retry))));
  url.searchParams.delete("consent-timeout");
  url.searchParams.delete("menu-timeout");
  url.searchParams.delete("menu-attempt");
  const timeoutUrl = new URL(url);
  timeoutUrl.searchParams.set("consent-timeout", "1");
  timeoutUrl.searchParams.set("consent-retry", String(Math.max(0, Math.min(2, retry)) + 1));
  // GetDigits with no input does not call callbackUrl: AT executes the next
  // XML action. Redirect back with a timeout marker so the callback can repeat
  // the prompt once and then end without recording or transferring.
  return `<GetDigits numDigits="1" timeout="8" callbackUrl="${xmlEscape(url.toString())}"><Say>${xmlEscape(notice)}</Say></GetDigits><Redirect>${xmlEscape(timeoutUrl.toString())}</Redirect>`;
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
