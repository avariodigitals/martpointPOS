import { supabase } from "@/lib/supabase";

export type RecordingCall = {
  id: string;
  business_id: string;
  recording_consent_at: string | null;
  recording_choice: string | null;
};

/** Import only after explicit consent, and never expose the provider URL. */
export async function importAfricaCallRecording(
  call: RecordingCall,
  urlValue: string,
  reference: string,
  retentionDays: number,
) {
  if (call.recording_choice !== "accepted" || !call.recording_consent_at)
    throw new Error("No recording consent exists for this call");
  const { data: existing, error: lookupError } = await supabase
    .from("azera_call_recordings")
    .select("id")
    .eq("call_id", call.id)
    .eq("provider_reference", reference)
    .maybeSingle();
  if (lookupError) throw new Error("Could not check recording history");
  if (existing) return existing.id;
  const url = new URL(urlValue);
  const hosts = (
    process.env.AFRICASTALKING_RECORDING_HOSTS || "africastalking.com"
  )
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    (url.port && url.port !== "443") ||
    !hosts.some(
      (host) => url.hostname === host || url.hostname.endsWith(`.${host}`),
    )
  )
    throw new Error("Unapproved provider recording host");
  const response = await fetch(url, {
    redirect: "error",
    signal: AbortSignal.timeout(15_000),
  });
  const mime = (response.headers.get("content-type") || "").split(";")[0];
  const max = 25 * 1024 * 1024;
  if (
    !response.ok ||
    ![
      "audio/wav",
      "audio/x-wav",
      "audio/mpeg",
      "audio/mp3",
      "audio/ogg",
      "audio/mp4",
      "audio/webm",
    ].includes(mime) ||
    Number(response.headers.get("content-length") || 0) > max
  )
    throw new Error("Provider recording could not be downloaded");
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Provider recording was empty");
  const chunks: Uint8Array[] = [];
  let length = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > max) {
      await reader.cancel();
      throw new Error("Provider recording exceeds the import limit");
    }
    chunks.push(value);
  }
  if (!length) throw new Error("Provider recording was empty");
  const extension = mime.includes("wav")
    ? "wav"
    : mime.includes("ogg")
      ? "ogg"
      : mime.includes("mp4")
        ? "m4a"
        : mime.includes("webm")
          ? "webm"
          : "mp3";
  const path = `${call.business_id}/${call.id}/${crypto.randomUUID()}.${extension}`;
  const bucket = supabase.storage.from("call-recordings");
  const { error: uploadError } = await bucket.upload(
    path,
    Buffer.concat(chunks),
    { contentType: mime, upsert: false },
  );
  if (uploadError) throw new Error("Could not store the private recording");
  const { data, error } = await supabase
    .from("azera_call_recordings")
    .insert({
      call_id: call.id,
      business_id: call.business_id,
      recording_url: "",
      recording_path: path,
      recording_type: "auto",
      provider_reference: reference,
      consent_confirmed_at: call.recording_consent_at,
      retention_expires_at: new Date(
        Date.now() + Math.min(365, Math.max(1, retentionDays)) * 86400_000,
      ).toISOString(),
      file_size_bytes: length,
      mime_type: mime,
    })
    .select("id")
    .single();
  if (error) {
    await bucket.remove([path]);
    if (error.code === "23505") return null; // Concurrent callback already saved it.
    throw new Error("Could not save recording history");
  }
  return data.id;
}
