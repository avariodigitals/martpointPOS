import { notifyAllAdmins } from "./admin-notifications"
import { isSupabaseConfigured } from "./supabase"

type Queue = "sales" | "support" | "customer_support"

/** Fan an inbound conversation event out to active admin users. */
export async function notifySupportAgents(input: {
  queue: Queue
  title: string
  message: string
  deepLink: string
  sourceId: string
}) {
  if (!input.sourceId) return

  if (!isSupabaseConfigured()) return

  await notifyAllAdmins({
    type: "OMNICHANNEL_INBOUND",
    title: input.title,
    message: input.message,
    deep_link: input.deepLink,
    source_type: "azera_conversation",
    source_id: input.sourceId,
    roles: input.queue === "sales" ? ["Admin", "Sales"] : ["Admin", "Customer Care", "Tech"],
    email: {
      route: input.queue === "sales" ? "lead_submission" : "support_ticket",
      subject: input.title,
      text: `${input.title}\n\n${input.message}\n\nOpen the conversation in the Admin Portal:\n${input.deepLink}`,
    },
  })
}
