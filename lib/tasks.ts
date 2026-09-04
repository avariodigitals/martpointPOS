import { supabase, isSupabaseConfigured } from "./supabase"

export type AdminTaskStatus = "OPEN" | "IN_PROGRESS" | "DONE" | "DISMISSED"
export type AdminTaskType =
  | "PARTNER_APPLICATION_REVIEW"
  | "PARTNER_COMPLIANCE_REQUIRED"
  | "CUSTOMER_ONBOARDING_REVIEW"
  | "BUSINESS_DEPLOYMENT_PENDING"
  | "PAYMENT_CONFIRMATION_PENDING"
  | "RENEWAL_APPROACHING"
  | "SUPPORT_UNASSIGNED"
  | "SLA_BREACH"
  | "CUSTOMER_FOLLOW_UP_DUE"
  | "COMPLIANCE_EXPIRING"
  | "OTHER"

export type AdminTask = {
  id: string
  task_type: AdminTaskType
  title: string
  description?: string | null
  source_type?: string | null
  source_id?: string | null
  status: AdminTaskStatus
  priority?: string | null
  assigned_to?: string | null
  due_at?: string | null
  deep_link?: string | null
  completed_at?: string | null
  created_at: string
  updated_at: string
}

function now() {
  return new Date().toISOString()
}

type TaskSeed = {
  task_type: AdminTaskType
  title: string
  description?: string
  source_type: string
  source_id: string
  priority: "LOW" | "NORMAL" | "HIGH" | "URGENT"
  due_at?: string
  deep_link?: string
}

function linkFor(sourceType: string, sourceId: string, taskType: AdminTaskType): string {
  if (sourceType === "SUPPORT_TICKET") return `/admin/support/${sourceId}`
  if (sourceType === "COMPLIANCE_RECORD") return `/admin/compliance?id=${sourceId}`
  if (sourceType === "CUSTOMER_SUCCESS_PROFILE") return `/admin/businesses/${sourceId}`
  if (sourceType === "PAYMENT") return `/admin/finance/commercial/payments`
  if (sourceType === "SUBSCRIPTION_RENEWAL") return `/admin/finance/commercial/renewals`
  if (sourceType === "BUSINESS_DEPLOYMENT") return `/admin/businesses/${sourceId}`
  if (sourceType === "ONBOARDING") return `/admin/onboarding?id=${sourceId}`
  if (sourceType === "PARTNER_APPLICATION") return `/admin/partners/applications/${sourceId}`
  if (sourceType === "PARTNER" && taskType === "PARTNER_COMPLIANCE_REQUIRED") return `/admin/partners/${sourceId}`
  return "#"
}

async function collectSeeds(): Promise<TaskSeed[]> {
  if (!isSupabaseConfigured()) return []

  const [
    partnerApplications,
    partnerCompliance,
    onboardingReviews,
    pendingDeployments,
    pendingPayments,
    approachingRenewals,
    unassignedTickets,
    slaBreaches,
    followUps,
    expiringCompliance,
  ] = await Promise.all([
    supabase.from("partner_applications").select("id, business_name, submitted_at").eq("status", "SUBMITTED"),
    supabase.from("compliance_records").select("id, partner_id, business_id, requirement_type").eq("status", "REQUESTED"),
    supabase.from("onboarding").select("id, business_name").eq("status", "PENDING_REVIEW"),
    supabase.from("business_deployments").select("id, business_id, status").eq("status", "PENDING"),
    supabase.from("payments").select("id, business_id, payment_reference").eq("status", "PENDING"),
    supabase.from("subscription_renewals").select("id, subscription_id, renewal_due_date").lte("renewal_due_date", new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]).in("status", ["UPCOMING", "DUE"]),
    supabase.from("support_tickets").select("id, ticket_number, subject").is("assigned_admin_user_id", null).in("status", ["NEW", "IN_PROGRESS"]),
    supabase.from("support_tickets").select("id, ticket_number, first_response_due_at, resolution_due_at").in("status", ["NEW", "ASSIGNED", "IN_PROGRESS", "WAITING_CUSTOMER", "WAITING_PARTNER"]),
    supabase.from("customer_success_profiles").select("id, business_id, next_follow_up_at").lte("next_follow_up_at", now()),
    supabase.from("compliance_records").select("id, business_id, partner_id, expires_at").lte("expires_at", new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()).neq("status", "EXPIRED"),
  ])

  const seeds: TaskSeed[] = []

  for (const a of (partnerApplications.data as { id: string; business_name: string }[] | null) || []) {
    seeds.push({
      task_type: "PARTNER_APPLICATION_REVIEW",
      title: "Review partner application",
      description: a.business_name,
      source_type: "PARTNER_APPLICATION",
      source_id: a.id,
      priority: "NORMAL",
      due_at: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
    })
  }

  for (const c of (partnerCompliance.data as { id: string; partner_id?: string; business_id?: string; requirement_type: string }[] | null) || []) {
    seeds.push({
      task_type: "PARTNER_COMPLIANCE_REQUIRED",
      title: `Partner compliance: ${c.requirement_type}`,
      source_type: "COMPLIANCE_RECORD",
      source_id: c.id,
      priority: "NORMAL",
      due_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    })
  }

  for (const o of (onboardingReviews.data as { id: string; business_name: string }[] | null) || []) {
    seeds.push({
      task_type: "CUSTOMER_ONBOARDING_REVIEW",
      title: `Onboarding review: ${o.business_name}`,
      source_type: "ONBOARDING",
      source_id: o.id,
      priority: "HIGH",
      due_at: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(),
    })
  }

  for (const d of (pendingDeployments.data as { id: string; business_id: string }[] | null) || []) {
    seeds.push({
      task_type: "BUSINESS_DEPLOYMENT_PENDING",
      title: "Business deployment pending",
      source_type: "BUSINESS_DEPLOYMENT",
      source_id: d.id,
      priority: "NORMAL",
      due_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    })
  }

  for (const p of (pendingPayments.data as { id: string; payment_reference: string }[] | null) || []) {
    seeds.push({
      task_type: "PAYMENT_CONFIRMATION_PENDING",
      title: `Payment awaiting confirmation: ${p.payment_reference}`,
      source_type: "PAYMENT",
      source_id: p.id,
      priority: "HIGH",
      due_at: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(),
    })
  }

  for (const r of (approachingRenewals.data as { id: string; subscription_id: string }[] | null) || []) {
    seeds.push({
      task_type: "RENEWAL_APPROACHING",
      title: "Subscription renewal approaching",
      source_type: "SUBSCRIPTION_RENEWAL",
      source_id: r.id,
      priority: "NORMAL",
      due_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    })
  }

  for (const t of (unassignedTickets.data as { id: string; ticket_number: string; subject: string }[] | null) || []) {
    seeds.push({
      task_type: "SUPPORT_UNASSIGNED",
      title: `Unassigned ticket: ${t.ticket_number}`,
      description: t.subject,
      source_type: "SUPPORT_TICKET",
      source_id: t.id,
      priority: "HIGH",
      due_at: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
    })
  }

  const nowTime = Date.now()
  for (const t of (slaBreaches.data as { id: string; ticket_number: string; first_response_due_at?: string; resolution_due_at?: string }[] | null) || []) {
    const due = t.first_response_due_at ? new Date(t.first_response_due_at).getTime() : t.resolution_due_at ? new Date(t.resolution_due_at).getTime() : null
    if (due && due < nowTime) {
      seeds.push({
        task_type: "SLA_BREACH",
        title: `SLA breached: ${t.ticket_number}`,
        source_type: "SUPPORT_TICKET",
        source_id: t.id,
        priority: "URGENT",
        due_at: new Date(due).toISOString(),
      })
    }
  }

  for (const f of (followUps.data as { id: string; business_id: string }[] | null) || []) {
    seeds.push({
      task_type: "CUSTOMER_FOLLOW_UP_DUE",
      title: "Customer follow-up due",
      source_type: "CUSTOMER_SUCCESS_PROFILE",
      source_id: f.business_id,
      priority: "NORMAL",
      due_at: f.business_id ? now() : undefined,
    })
  }

  for (const e of (expiringCompliance.data as { id: string; business_id?: string; partner_id?: string }[] | null) || []) {
    seeds.push({
      task_type: "COMPLIANCE_EXPIRING",
      title: "Compliance record expiring",
      source_type: "COMPLIANCE_RECORD",
      source_id: e.id,
      priority: "NORMAL",
      due_at: (e as any).expires_at,
    })
  }

  return seeds
}

export async function syncAdminTasks(): Promise<AdminTask[]> {
  if (!isSupabaseConfigured()) return []

  const seeds = await collectSeeds()
  const nowStr = now()

  const activeKeys = new Set<string>()

  for (const seed of seeds) {
    const key = `${seed.source_type}:${seed.source_id}:${seed.task_type}`
    activeKeys.add(key)

    const { data, error } = await supabase
      .from("admin_tasks")
      .insert({
        task_type: seed.task_type,
        title: seed.title,
        description: seed.description,
        source_type: seed.source_type,
        source_id: seed.source_id,
        priority: seed.priority,
        due_at: seed.due_at,
        deep_link: seed.deep_link ?? linkFor(seed.source_type, seed.source_id, seed.task_type),
        status: "OPEN",
        created_at: nowStr,
        updated_at: nowStr,
      })
      .select()
      .single()

    if (error && error.code !== "23505") {
      console.error("[tasks] upsert failed", error)
      continue
    }

    if (data) {
      // Newly inserted
    } else {
      // Conflict on existing — do not overwrite DONE/DISMISSED or user-assigned fields
      await supabase
        .from("admin_tasks")
        .update({
          title: seed.title,
          description: seed.description,
          priority: seed.priority,
          due_at: seed.due_at,
          updated_at: nowStr,
        })
        .eq("source_type", seed.source_type)
        .eq("source_id", seed.source_id)
        .eq("task_type", seed.task_type)
        .not("status", "in", '("DONE","DISMISSED")')
    }
  }

  // Mark stale open/in_progress tasks as done if the underlying condition has resolved
  const { data: openTasks } = await supabase
    .from("admin_tasks")
    .select("source_type, source_id, task_type")
    .in("status", ["OPEN", "IN_PROGRESS"])
    .not("source_type", "is", null)
    .not("source_id", "is", null)

  const stale = ((openTasks as { source_type: string; source_id: string; task_type: string }[]) || []).filter(
    (t) => !activeKeys.has(`${t.source_type}:${t.source_id}:${t.task_type}`)
  )

  for (const t of stale) {
    await supabase
      .from("admin_tasks")
      .update({
        status: "DONE",
        completed_at: nowStr,
        updated_at: nowStr,
      })
      .eq("source_type", t.source_type)
      .eq("source_id", t.source_id)
      .eq("task_type", t.task_type)
  }

  const { data: tasks, error: listError } = await supabase
    .from("admin_tasks")
    .select("*")
    .in("status", ["OPEN", "IN_PROGRESS"])
    .order("due_at", { ascending: true })

  if (listError) throw new Error(`Task list failed: ${listError.message}`)
  return (tasks || []) as AdminTask[]
}

export async function listAdminTasks(status?: AdminTaskStatus): Promise<AdminTask[]> {
  if (!isSupabaseConfigured()) return []
  let q = supabase.from("admin_tasks").select("*").order("due_at", { ascending: true })
  if (status) q = q.eq("status", status)
  const { data, error } = await q
  if (error) throw new Error(`Task list failed: ${error.message}`)
  return (data || []) as AdminTask[]
}

export async function updateAdminTask(
  taskId: string,
  status: AdminTaskStatus,
  actorId?: string
): Promise<AdminTask> {
  if (!isSupabaseConfigured()) throw new Error("Supabase not configured")

  const completed = status === "DONE" || status === "DISMISSED" ? now() : null

  const { data, error } = await supabase
    .from("admin_tasks")
    .update({
      status,
      assigned_to: actorId,
      completed_at: completed,
      updated_at: now(),
    })
    .eq("id", taskId)
    .select()
    .single()

  if (error || !data) throw new Error(`Task update failed: ${error?.message || "unknown"}`)
  return data as AdminTask
}

export async function resolveAdminTasks(
  sourceType: string,
  sourceId: string,
  taskTypes?: AdminTaskType[]
): Promise<void> {
  if (!isSupabaseConfigured()) return

  let q = supabase
    .from("admin_tasks")
    .update({
      status: "DONE",
      completed_at: now(),
      updated_at: now(),
    })
    .eq("source_type", sourceType)
    .eq("source_id", sourceId)
    .in("status", ["OPEN", "IN_PROGRESS"])

  if (taskTypes && taskTypes.length) q = q.in("task_type", taskTypes)

  await q
}
