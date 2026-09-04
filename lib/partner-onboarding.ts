import { supabase, isSupabaseConfigured } from "./supabase"
import { recordAudit, AUDIT_ACTIONS, AUDIT_ENTITIES, type AuditContext } from "./audit"

export interface OnboardingTaskInput {
  businessId: string
  partnerId?: string | null
  assignmentId?: string | null
  category: string
  title: string
  description?: string
  required?: boolean
}

export interface TrainingRecordInput {
  businessId: string
  partnerId: string
  trainerPartnerUserId: string
  trainingType: "ADMIN" | "POS" | "INVENTORY" | "REPORTING" | "ONLINE_STORE" | "OTHER"
  trainingDate: string
  attendeesCount?: number
  attendeeNames?: string
  notes?: string
  evidencePath?: string
}

export async function getOnboardingTasks(businessId: string): Promise<Record<string, unknown>[]> {
  if (!isSupabaseConfigured()) return []
  const { data, error } = await supabase
    .from("partner_onboarding_tasks")
    .select("*")
    .eq("business_id", businessId)
    .order("created_at", { ascending: true })
  if (error || !data) return []
  return data as Record<string, unknown>[]
}

export async function createOnboardingTask(
  input: OnboardingTaskInput,
  createdBy: string,
  ctx: AuditContext
): Promise<{ ok: boolean; error?: string; task?: Record<string, unknown> }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Database not configured" }
  const { data, error } = await supabase
    .from("partner_onboarding_tasks")
    .insert({
      business_id: input.businessId,
      partner_id: input.partnerId ?? null,
      assignment_id: input.assignmentId ?? null,
      category: input.category,
      title: input.title,
      description: input.description ?? null,
      required: input.required ?? false,
      status: "NOT_STARTED",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error || !data) return { ok: false, error: "Failed to create task" }

  await recordAudit(ctx, {
    action: AUDIT_ACTIONS.PARTNER_ONBOARDING_STARTED,
    entityType: AUDIT_ENTITIES.PARTNER_ONBOARDING_TASK,
    entityId: data.id as string,
    metadata: { businessId: input.businessId, category: input.category },
  })

  return { ok: true, task: data }
}

export async function updateOnboardingTask(
  taskId: string,
  partnerUserId: string,
  status: "NOT_STARTED" | "IN_PROGRESS" | "BLOCKED" | "COMPLETED",
  notes?: string,
  ctx?: AuditContext
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Database not configured" }
  const update: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
    notes: notes ?? null,
  }
  if (status === "COMPLETED") {
    update.completed_by = partnerUserId
    update.completed_at = new Date().toISOString()
  }

  const { error } = await supabase.from("partner_onboarding_tasks").update(update).eq("id", taskId)
  if (error) return { ok: false, error: "Failed to update task" }

  if (ctx) {
    await recordAudit(ctx, {
      action: AUDIT_ACTIONS.PARTNER_ONBOARDING_TASK_UPDATED,
      entityType: AUDIT_ENTITIES.PARTNER_ONBOARDING_TASK,
      entityId: taskId,
      metadata: { status, notes },
    })
  }

  return { ok: true }
}

export async function verifyOnboardingTask(
  taskId: string,
  adminId: string,
  reopen = false,
  ctx: AuditContext
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Database not configured" }

  const newStatus = reopen ? "NOT_STARTED" : "VERIFIED"
  const update: Record<string, unknown> = {
    status: newStatus,
    updated_at: new Date().toISOString(),
  }

  if (reopen) {
    update.completed_by = null
    update.completed_at = null
    update.verified_by = null
    update.verified_at = null
  } else {
    update.verified_by = adminId
    update.verified_at = new Date().toISOString()
  }

  const { error } = await supabase.from("partner_onboarding_tasks").update(update).eq("id", taskId)
  if (error) return { ok: false, error: "Failed to update task" }

  await recordAudit(ctx, {
    action: reopen ? AUDIT_ACTIONS.PARTNER_ONBOARDING_REOPENED : AUDIT_ACTIONS.PARTNER_ONBOARDING_VERIFIED,
    entityType: AUDIT_ENTITIES.PARTNER_ONBOARDING_TASK,
    entityId: taskId,
    metadata: { adminId, reopen },
  })

  return { ok: true }
}

export async function submitOnboardingComplete(
  businessId: string,
  partnerId: string,
  partnerUserId: string,
  ctx: AuditContext
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Database not configured" }

  const tasks = await getOnboardingTasks(businessId)
  const requiredPending = tasks.filter((t) => t.required && t.status !== "COMPLETED" && t.status !== "VERIFIED")
  if (requiredPending.length > 0) {
    return { ok: false, error: "All required tasks must be completed before submission" }
  }

  const { error } = await supabase
    .from("businesses")
    .update({ status: "PARTNER_COMPLETED" as any, updated_at: new Date().toISOString() })
    .eq("id", businessId)

  if (error) return { ok: false, error: "Failed to submit onboarding" }

  await recordAudit(ctx, {
    action: AUDIT_ACTIONS.PARTNER_ONBOARDING_COMPLETED,
    entityType: AUDIT_ENTITIES.BUSINESS,
    entityId: businessId,
    metadata: { partnerId, partnerUserId, status: "PARTNER_COMPLETED" },
  })

  return { ok: true }
}

export async function adminApproveGoLive(
  businessId: string,
  adminId: string,
  ctx: AuditContext
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Database not configured" }
  const { error } = await supabase
    .from("businesses")
    .update({ status: "GO_LIVE_APPROVED" as any, updated_at: new Date().toISOString() })
    .eq("id", businessId)
  if (error) return { ok: false, error: "Failed to approve" }

  await recordAudit(ctx, {
    action: AUDIT_ACTIONS.PARTNER_ONBOARDING_VERIFIED,
    entityType: AUDIT_ENTITIES.BUSINESS,
    entityId: businessId,
    metadata: { adminId, status: "GO_LIVE_APPROVED" },
  })

  return { ok: true }
}

export async function createTrainingRecord(
  input: TrainingRecordInput,
  ctx: AuditContext
): Promise<{ ok: boolean; error?: string; record?: Record<string, unknown> }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Database not configured" }
  const { data, error } = await supabase
    .from("customer_training_records")
    .insert({
      business_id: input.businessId,
      partner_id: input.partnerId,
      trainer_partner_user_id: input.trainerPartnerUserId,
      training_type: input.trainingType,
      training_date: input.trainingDate,
      attendees_count: input.attendeesCount ?? 1,
      attendee_names: input.attendeeNames ?? null,
      notes: input.notes ?? null,
      evidence_path: input.evidencePath ?? null,
      customer_acknowledged: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error || !data) return { ok: false, error: "Failed to record training" }

  await recordAudit(ctx, {
    action: AUDIT_ACTIONS.CUSTOMER_TRAINING_RECORDED,
    entityType: AUDIT_ENTITIES.CUSTOMER_TRAINING_RECORD,
    entityId: data.id as string,
    metadata: { businessId: input.businessId, trainingType: input.trainingType },
  })

  return { ok: true, record: data }
}

export async function listTrainingRecords(businessId: string): Promise<Record<string, unknown>[]> {
  if (!isSupabaseConfigured()) return []
  const { data, error } = await supabase
    .from("customer_training_records")
    .select("*")
    .eq("business_id", businessId)
    .order("training_date", { ascending: false })
  if (error || !data) return []
  return data as Record<string, unknown>[]
}

export async function getBusinessEntitlement(businessId: string): Promise<Record<string, unknown> | null> {
  if (!isSupabaseConfigured()) return null
  const { data, error } = await supabase
    .from("business_entitlements")
    .select("*")
    .eq("business_id", businessId)
    .maybeSingle()
  if (error || !data) return null
  return data
}

export async function updateBusinessEntitlement(
  businessId: string,
  updates: Partial<{
    planCode: string | null
    maxBranches: number
    maxUsers: number
    onlineStoreEnabled: boolean
    implementationEnabled: boolean
    subscriptionStatus: string
    effectiveFrom: string
    effectiveUntil: string | null
  }>,
  adminId: string,
  ctx: AuditContext
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Database not configured" }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (updates.planCode !== undefined) update.plan_code = updates.planCode
  if (updates.maxBranches !== undefined) update.max_branches = updates.maxBranches
  if (updates.maxUsers !== undefined) update.max_users = updates.maxUsers
  if (updates.onlineStoreEnabled !== undefined) update.online_store_enabled = updates.onlineStoreEnabled
  if (updates.implementationEnabled !== undefined) update.implementation_enabled = updates.implementationEnabled
  if (updates.subscriptionStatus !== undefined) update.subscription_status = updates.subscriptionStatus
  if (updates.effectiveFrom !== undefined) update.effective_from = updates.effectiveFrom
  if (updates.effectiveUntil !== undefined) update.effective_until = updates.effectiveUntil

  const { error } = await supabase.from("business_entitlements").update(update).eq("business_id", businessId)
  if (error) return { ok: false, error: "Failed to update entitlement" }

  await recordAudit(ctx, {
    action: AUDIT_ACTIONS.BUSINESS_ENTITLEMENT_UPDATED,
    entityType: AUDIT_ENTITIES.BUSINESS_ENTITLEMENT,
    entityId: businessId,
    metadata: { adminId, updates },
  })

  return { ok: true }
}

export async function getBusinessDeployment(businessId: string): Promise<Record<string, unknown> | null> {
  if (!isSupabaseConfigured()) return null
  const { data, error } = await supabase
    .from("business_deployments")
    .select("*")
    .eq("business_id", businessId)
    .maybeSingle()
  if (error || !data) return null
  return data
}

export async function updateBusinessDeployment(
  businessId: string,
  updates: Partial<{
    status: string
    environmentUrl: string | null
    adminUrl: string | null
    onlineStoreUrl: string | null
    provisionedAt: string | null
    goLiveAt: string | null
    internalNotes: string | null
  }>,
  adminId: string,
  ctx: AuditContext
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Database not configured" }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (updates.status !== undefined) update.status = updates.status
  if (updates.environmentUrl !== undefined) update.environment_url = updates.environmentUrl
  if (updates.adminUrl !== undefined) update.admin_url = updates.adminUrl
  if (updates.onlineStoreUrl !== undefined) update.online_store_url = updates.onlineStoreUrl
  if (updates.provisionedAt !== undefined) update.provisioned_at = updates.provisionedAt
  if (updates.goLiveAt !== undefined) update.go_live_at = updates.goLiveAt
  if (updates.internalNotes !== undefined) update.internal_notes = updates.internalNotes

  const { error } = await supabase.from("business_deployments").update(update).eq("business_id", businessId)
  if (error) return { ok: false, error: "Failed to update deployment" }

  await recordAudit(ctx, {
    action: AUDIT_ACTIONS.BUSINESS_DEPLOYMENT_STATUS_UPDATED,
    entityType: AUDIT_ENTITIES.BUSINESS_DEPLOYMENT,
    entityId: businessId,
    metadata: { adminId, updates },
  })

  return { ok: true }
}
