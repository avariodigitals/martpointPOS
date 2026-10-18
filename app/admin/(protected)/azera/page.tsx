import { OmnichannelInbox } from "@/components/admin/omnichannel-inbox"

/**
 * Azera is the conversation engine behind the unified support workspace.
 * Keeping the route makes existing bookmarks work while presenting the same
 * queue, thread, customer context, and ticket actions as every other channel.
 */
export default function AzeraConsolePage() {
  return <OmnichannelInbox channel="all" />
}
