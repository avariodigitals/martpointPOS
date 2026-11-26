import { NextResponse } from "next/server"
import { authorizeAdmin } from "@/lib/admin-auth"
import { hasFinanceActionForUser } from "@/lib/finance-permissions"
import { isSupabaseConfigured, supabase } from "@/lib/supabase"

export const dynamic = "force-dynamic"

const jsonError = (message: string, status = 400) => NextResponse.json({ success: false, error: message }, { status })

export async function GET() {
  const { session, denied } = await authorizeAdmin("finance")
  if (denied) return denied
  if (!session || !await hasFinanceActionForUser(session.userId, session.role, "finance:view")) return jsonError("Forbidden", 403)
  if (!isSupabaseConfigured()) return jsonError("Database not configured", 500)

  const { data, error } = await supabase
    .from("finance_account_sweeps")
    .select("*")
    .order("created_at", { ascending: false })
  if (error) {
    console.error("[finance/sweeps] GET", error)
    return jsonError("Failed to load scheduled sweeps", 500)
  }
  return NextResponse.json({ success: true, sweeps: data || [] })
}

export async function POST(request: Request) {
  const { session, denied } = await authorizeAdmin("finance")
  if (denied) return denied
  if (!session || !await hasFinanceActionForUser(session.userId, session.role, "finance:accounts:manage")) return jsonError("Forbidden", 403)
  if (!isSupabaseConfigured()) return jsonError("Database not configured", 500)

  try {
    const body = await request.json() as Record<string, unknown>
    const action = body.action

    if (action === "create") {
      const sourceAccountId = String(body.source_account_id || "")
      const destinationAccountId = String(body.destination_account_id || "")
      const intervalDays = Number(body.interval_days)
      if (!sourceAccountId || !destinationAccountId) return jsonError("Choose both accounts")
      if (sourceAccountId === destinationAccountId) return jsonError("Choose two different accounts")
      if (!Number.isInteger(intervalDays) || intervalDays < 1 || intervalDays > 365) return jsonError("Interval must be between 1 and 365 days")

      const { data: accounts, error } = await supabase
        .from("payment_accounts")
        .select("id, currency, active")
        .in("id", [sourceAccountId, destinationAccountId])
      if (error) throw error
      const source = accounts?.find((account) => account.id === sourceAccountId)
      const destination = accounts?.find((account) => account.id === destinationAccountId)
      if (!source?.active || !destination?.active) return jsonError("Both accounts must be active")
      if (source.currency !== destination.currency) return jsonError("Scheduled sweeps require both accounts to use the same currency")

      const { data: existingSweep, error: existingError } = await supabase.from("finance_account_sweeps")
        .select("id")
        .eq("source_account_id", sourceAccountId)
        .eq("active", true)
        .limit(1)
        .maybeSingle()
      if (existingError) throw existingError
      if (existingSweep) return jsonError("This source account already has an active sweep")

      const now = new Date()
      const nextRunAt = new Date(now.getTime() + intervalDays * 24 * 60 * 60 * 1000).toISOString()
      const { data, error: insertError } = await supabase
        .from("finance_account_sweeps")
        .insert({
          source_account_id: sourceAccountId,
          destination_account_id: destinationAccountId,
          interval_days: intervalDays,
          next_run_at: nextRunAt,
          active: true,
          created_at: now.toISOString(),
          updated_at: now.toISOString(),
        })
        .select()
        .single()
      if (insertError) throw insertError
      return NextResponse.json({ success: true, sweep: data })
    }

    if (action === "update") {
      const id = String(body.id || "")
      if (!id || typeof body.active !== "boolean") return jsonError("Sweep ID and active status are required")
      if (body.active) {
        const { data: current, error: currentError } = await supabase.from("finance_account_sweeps")
          .select("source_account_id")
          .eq("id", id)
          .maybeSingle()
        if (currentError) throw currentError
        if (!current) return jsonError("Scheduled sweep not found", 404)
        const { data: otherActive, error: activeError } = await supabase.from("finance_account_sweeps")
          .select("id")
          .eq("source_account_id", current.source_account_id)
          .eq("active", true)
          .neq("id", id)
          .limit(1)
          .maybeSingle()
        if (activeError) throw activeError
        if (otherActive) return jsonError("This source account already has another active sweep", 409)
      }
      const { data, error } = await supabase
        .from("finance_account_sweeps")
        .update({ active: body.active, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single()
      if (error) throw error
      return NextResponse.json({ success: true, sweep: data })
    }

    if (action === "delete") {
      const id = String(body.id || "")
      if (!id) return jsonError("Sweep ID is required")
      const { error } = await supabase.from("finance_account_sweeps").delete().eq("id", id)
      if (error) throw error
      return NextResponse.json({ success: true })
    }

    return jsonError("Unknown action")
  } catch (error) {
    console.error("[finance/sweeps] POST", error)
    if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") {
      return jsonError("This source account already has an active sweep", 409)
    }
    return jsonError("Failed to save scheduled sweep", 500)
  }
}
