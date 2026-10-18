import { getAllUsers } from "./admin-auth"
import { createAdminNotification } from "./admin-notifications"

const SUPPORT_ROLES = new Set(["Admin", "Customer Care", "Tech"])

/** Fan an inbound conversation event out to the staff who can act on it. */
export async function notifySupportAgents(input: {
  title: string
  message: string
  deepLink: string
  sourceId: string
}) {
  if (!input.sourceId) return

  const users = (await getAllUsers()).filter(
    (user) => user.status === "ACTIVE" && SUPPORT_ROLES.has(user.role),
  )

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
