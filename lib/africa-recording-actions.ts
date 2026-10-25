import { xmlEscape } from "@/lib/africastalking";

export function recordingConsentAction(callback: string, notice: string) {
  if (!/press\s+1\b/i.test(notice) || !/press\s+2\b/i.test(notice))
    notice +=
      " Press 1 to agree to recording, or press 2 to continue without recording.";
  const url = new URL(callback);
  url.searchParams.set("stage", "recording-consent");
  return `<GetDigits numDigits="1" timeout="8" callbackUrl="${xmlEscape(url.toString())}"><Say>${xmlEscape(notice)}</Say></GetDigits>`;
}
export function recordedDialAction(
  destinations: string[],
  callerId: string,
  waitingAudioUrl: string,
  record: boolean,
) {
  return `<Dial phoneNumbers="${xmlEscape(destinations.join(","))}" sequential="true"${callerId ? ` callerId="${xmlEscape(callerId)}"` : ""}${waitingAudioUrl ? ` ringbackTone="${xmlEscape(waitingAudioUrl)}"` : ""}${record ? ' record="true"' : ""}/>`;
}
