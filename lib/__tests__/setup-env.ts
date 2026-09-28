import dotenv from "dotenv"

dotenv.config({ path: ".env.local", quiet: true })
dotenv.config({ path: ".env", quiet: true })

// @supabase/supabase-js requires a WebSocket global to construct the realtime
// client (Node <22 lacks one); these tests never open a realtime channel.
if (typeof globalThis.WebSocket === "undefined") {
  class NoopWebSocket {
    constructor() {
      throw new Error("Realtime is not supported in tests")
    }
  }
  ;(globalThis as Record<string, unknown>).WebSocket = NoopWebSocket
}
