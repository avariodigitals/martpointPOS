import { xmlEscape } from "@/lib/africastalking";

/** Separate a combined legacy welcome/menu without losing configured options. */
export function splitVoiceMenuGreeting(greeting: string) {
  const press = greeting.search(/\bpress\s+[1-9]\b/i);
  if (press < 0) return { introduction: greeting.trim() || "Welcome to MartPoint.", options: "" };
  let start = greeting.lastIndexOf("\n", press) + 1;
  for (const match of greeting.slice(0, press).matchAll(/[.!?]\s+/g))
    start = Math.max(start, match.index! + match[0].length);
  return {
    introduction: greeting.slice(0, start || press).trim() || "Welcome to MartPoint.",
    options: greeting.slice(start || press).trim(),
  };
}

/** Explicit next-step URLs distinguish first entry, keypad replies and silence. */
export function departmentMenuAction(callback: string, prompt: string, audioUrl: string, attempt: number) {
  const url = new URL(callback);
  // Keypresses may have arrived at Events, but future voice actions (including
  // no-input Redirects) must go to the XML callback, not the status endpoint.
  url.pathname = "/api/africastalking/voice/callback";
  url.searchParams.set("stage", "department-menu");
  url.searchParams.set("menu-attempt", String(attempt));
  url.searchParams.delete("menu-timeout");
  url.searchParams.delete("consent-timeout");
  const timeout = new URL(url);
  timeout.searchParams.set("menu-timeout", "1");
  const action = audioUrl ? `<Play url="${xmlEscape(audioUrl)}"/>` : `<Say>${xmlEscape(prompt)}</Say>`;
  // AT does not POST callbackUrl for silence; Redirect explicitly continues.
  return `<GetDigits numDigits="1" timeout="8" finishOnKey="#" callbackUrl="${xmlEscape(url.toString())}">${action}</GetDigits><Redirect>${xmlEscape(timeout.toString())}</Redirect>`;
}
