import { getAllUsers } from "./admin-auth"
import { createAdminNotification } from "./admin-notifications"
import { supabase, isSupabaseConfigured } from "./supabase"

type Queue = "sales" | "support" | "customer_support"

/** Fan an inbound conversation event out to the staff who can act on it. */
export async function notifySupportAgents(input: {
  queue: Queue
  title: string
  message: string
  deepLink: string
  sourceId: string
}) {
  if (!input.sourceId) return

  if (!isSupabaseConfigured()) return

  const { data: agentRows, error } = await supabase
    .from("azera_agent_presence")
    .select("user_id")
    .eq("is_online", true)
    .contains("queues", [input.queue])

  if (error) {
    console.error("[Omnichannel notification agents lookup error]", error)
    return
  }

  const onlineIds = new Set((agentRows || []).map((row) => row.user_id as string))
  // Portal access alone is never enough. Only users explicitly registered as
  // Azera agents and currently online receive a live-chat alert.
  const users = (await getAllUsers()).filter((user) => user.status === "ACTIVE" && onlineIds.has(user.id))

  await Promise.all(
    users.map((user) =>
      createAdminNotification({
        admin_user_id: user.id,
        type: "OMNICHANNEL_INBOUND",
        title: input.title,
        message: input.message,
        deep_link: input.deepLink,
        source_type: "azera_conversation",
        source_id: input.sourceId,
      }).catch((error) => {
        console.error("[Omnichannel notification error]", error)
      }),
    ),
  )
}
