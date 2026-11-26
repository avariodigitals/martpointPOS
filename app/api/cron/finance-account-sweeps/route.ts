import { NextResponse } from "next/server"
import { postTransferJournal } from "@/lib/finance-ledger"
import { isSupabaseConfigured, supabase } from "@/lib/supabase"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

type DueSweep = {
  sweep_id: string
  source_account_id: string
  destination_account_id: string
  interval_days: number
  next_run_at: string
  claim_token: string
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status })
}

async function finishSweep(sweep: DueSweep, status: "COMPLETED" | "SKIPPED", amount: number, journalEntryId?: string | null, error?: string | null) {
  const now = new Date()
  const { error: runError } = await supabase.from("finance_account_sweep_runs")
    .update({ status, amount, journal_entry_id: journalEntryId || null, error: error || null, completed_at: now.toISOString() })
    .eq("sweep_id", sweep.sweep_id)
    .eq("scheduled_for", sweep.next_run_at)
  if (runError) throw runError

  const { error: sweepError } = await supabase.from("finance_account_sweeps")
    .update({
      next_run_at: new Date(now.getTime() + sweep.interval_days * 24 * 60 * 60 * 1000).toISOString(),
      claim_token: null,
      claim_expires_at: null,
      last_run_at: now.toISOString(),
      last_status: status,
      last_amount: amount,
      last_error: error || null,
      updated_at: now.toISOString(),
    })
    .eq("id", sweep.sweep_id)
    .eq("claim_token", sweep.claim_token)
  if (sweepError) throw sweepError
}

export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET
  if (!expected || request.headers.get("authorization") !== `Bearer ${expected}`) return jsonError("Unauthorized", 401)
  if (!isSupabaseConfigured()) return jsonError("Database not configured", 500)

  const { data: dueSweeps, error } = await supabase.rpc("claim_due_finance_account_sweeps", { p_limit: 25 })
  if (error) {
    console.error("[finance-account-sweeps] claim", error)
    return jsonError("Failed to claim due sweeps", 500)
  }

  const totals = { claimed: dueSweeps?.length || 0, completed: 0, skipped: 0, failed: 0 }

  for (const sweep of (dueSweeps || []) as DueSweep[]) {
    try {
      let { data: run, error: runLoadError } = await supabase.from("finance_account_sweep_runs")
        .select("id,status,journal_entry_id,amount")
        .eq("sweep_id", sweep.sweep_id)
        .eq("scheduled_for", sweep.next_run_at)
        .maybeSingle()
      if (runLoadError) throw runLoadError

      if (!run) {
        const { data: createdRun, error: createError } = await supabase.from("finance_account_sweep_runs")
          .insert({ sweep_id: sweep.sweep_id, scheduled_for: sweep.next_run_at, status: "PROCESSING" })
          .select("id,status,journal_entry_id,amount")
          .single()
        if (createError) throw createError
        run = createdRun
      } else if (run.status === "COMPLETED" || run.status === "SKIPPED") {
        await finishSweep(sweep, run.status, Number(run.amount) || 0, run.journal_entry_id)
        totals[run.status === "COMPLETED" ? "completed" : "skipped"]++
        continue
      } else {
        const { error: resetError } = await supabase.from("finance_account_sweep_runs")
          .update({ status: "PROCESSING", error: null, started_at: new Date().toISOString() })
          .eq("id", run.id)
        if (resetError) throw resetError
      }

      const { data: accounts, error: accountsError } = await supabase.from("payment_accounts")
        .select("id,name,gl_account_id,currency,active")
        .in("id", [sweep.source_account_id, sweep.destination_account_id])
      if (accountsError) throw accountsError
      const source = accounts?.find((account) => account.id === sweep.source_account_id)
      const destination = accounts?.find((account) => account.id === sweep.destination_account_id)

      if (!source?.active || !destination?.active || source.currency !== destination.currency) {
        const reason = !source?.active || !destination?.active ? "One or both accounts are inactive" : "Account currencies no longer match"
        await finishSweep(sweep, "SKIPPED", 0, null, reason)
        totals.skipped++
        continue
      }

      const { data: balanceData, error: balanceError } = await supabase.rpc("finance_payment_account_balance", { p_payment_account_id: source.id })
      if (balanceError) throw balanceError
      const balance = Number(balanceData)
      if (!Number.isFinite(balance)) throw new Error("Could not read source account balance")
      const amount = Number(Math.max(0, balance).toFixed(2))
      if (amount <= 0) {
        await finishSweep(sweep, "SKIPPED", 0, null, "Source account has no positive balance to sweep")
        totals.skipped++
        continue
      }

      const entry = await postTransferJournal({
        from_account_id: source.id,
        to_account_id: destination.id,
        amount,
        memo: `Scheduled sweep: ${source.name} → ${destination.name}`,
        source_id: run.id,
      })
      await finishSweep(sweep, "COMPLETED", amount, entry.id)
      totals.completed++
    } catch (caught) {
      const message = caught instanceof Error ? caught.message.slice(0, 500) : "Scheduled sweep failed"
      console.error("[finance-account-sweeps] run", sweep.sweep_id, caught)
      totals.failed++
      const now = new Date().toISOString()
      await supabase.from("finance_account_sweep_runs")
        .update({ status: "FAILED", error: message, completed_at: now })
        .eq("sweep_id", sweep.sweep_id)
        .eq("scheduled_for", sweep.next_run_at)
      await supabase.from("finance_account_sweeps")
        .update({ claim_token: null, claim_expires_at: null, last_run_at: now, last_status: "FAILED", last_error: message, updated_at: now })
        .eq("id", sweep.sweep_id)
        .eq("claim_token", sweep.claim_token)
    }
  }

  return NextResponse.json({ success: true, ...totals })
}
