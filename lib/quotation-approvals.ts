import { notifyAdminUser } from "@/lib/admin-notifications"
import { supabase } from "@/lib/supabase"

/** Alert the explicitly configured approvers; delivery is best-effort. */
export async function notifyQuotationApprovers(input: { quoteId: string; quoteNumber: string; requesterId: string }) {
  const { data: policy, error: policyError } = await supabase.from("approval_policies")
    .select("enabled,approver_roles,approver_user_ids").eq("action_key", "quotation.send").maybeSingle()
  if (policyError || !policy?.enabled) return
  const roles = Array.isArray(policy.approver_roles) ? policy.approver_roles.filter((role): role is string => typeof role === "string") : []
  const userIds = Array.isArray(policy.approver_user_ids) ? policy.approver_user_ids.filter((id): id is string => typeof id === "string") : []
  const { data: users, error } = await supabase.from("users").select("id,role").eq("status", "ACTIVE")
  if (error) return
  const targets = (users || []).filter((user) => user.id !== input.requesterId && (roles.includes(user.role) || userIds.includes(user.id)))
  await Promise.all(targets.map((user) => notifyAdminUser({
    admin_user_id: user.id,
    type: "QUOTATION_APPROVAL_REQUESTED",
    title: `Quotation ${input.quoteNumber} needs approval`,
    message: "Review the quote before it is sent to the client.",
    deep_link: "/admin/approvals",
    source_type: "LEAD_QUOTATION",
    source_id: input.quoteId,
    actor_admin_user_id: input.requesterId,
  })))
}
