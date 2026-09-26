import { NextResponse } from "next/server"
import { authorizeAdmin } from "@/lib/admin-auth"
import { hasFinanceAction } from "@/lib/finance-permissions"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import {
  getAccountStatement,
  getGlBalances,
  postJournalEntry,
  postTransferJournal,
  postDepositJournal,
  postPaymentJournal,
  postOpeningBalance,
  backfillLedger,
  voidEntriesForSource,
  validateJournalLines,
  type JournalLineInput,
} from "@/lib/finance-ledger"

const ok = (data: unknown) => NextResponse.json({ success: true, data })
const err = (message: string, status = 400) => NextResponse.json({ success: false, error: message }, { status })

/* ─── GET — lists, statements, journal, trial balance ─── */
export async function GET(request: Request) {
  const { session, denied } = await authorizeAdmin("finance")
  if (denied) return denied
  if (!session || !hasFinanceAction(session.role, "finance:view")) return err("Forbidden", 403)
  if (!isSupabaseConfigured()) return err("Database not configured", 500)

  try {
    const { searchParams } = new URL(request.url)
    const resource = searchParams.get("resource")

    if (resource === "gl-accounts") {
      const { data, error } = await supabase
        .from("gl_accounts")
        .select("*")
        .order("code", { ascending: true })
      if (error) return err(error.message, 500)
      const balances = await getGlBalances()
      return ok((data || []).map((a) => ({ ...a, balance: balances[(a as { id: string }).id] || 0 })))
    }

    if (resource === "payment-accounts") {
      const { data, error } = await supabase
        .from("payment_accounts")
        .select("*, gl_accounts(code, name, type)")
        .order("is_default", { ascending: false })
        .order("name", { ascending: true })
      if (error) return err(error.message, 500)

      const balances = await getGlBalances()
      return ok(
        ((data as unknown as Array<Record<string, unknown>>) || []).map((a) => ({
          ...a,
          balance: balances[(a as { gl_account_id: string }).gl_account_id] || 0,
        })),
      )
    }

    if (resource === "statement") {
      const statement = await getAccountStatement({
        gl_account_id: searchParams.get("gl") || undefined,
        payment_account_id: searchParams.get("account") || undefined,
        from: searchParams.get("from") || undefined,
        to: searchParams.get("to") || undefined,
      })
      return ok(statement)
    }

    if (resource === "journal") {
      const limit = Math.min(Number(searchParams.get("limit")) || 100, 500)
      const { data, error } = await supabase
        .from("journal_entries")
        .select("*, journal_lines(*, gl_accounts(code, name, type))")
        .order("entry_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(limit)
      if (error) return err(error.message, 500)
      return ok(data || [])
    }

    if (resource === "trial-balance") {
      const { data: accounts } = await supabase.from("gl_accounts").select("*").order("code")
      const balances = await getGlBalances()
      return ok(
        ((accounts as { id: string }[]) || []).map((a) => ({ ...a, balance: balances[a.id] || 0 })),
      )
    }

    return err("Unknown resource", 404)
  } catch (e) {
    console.error("[finance/ledger] GET", e)
    return err(String(e), 500)
  }
}

/* ─── POST — account management, transfers, deposits, manual journals, backfill ─── */
export async function POST(request: Request) {
  const { session, denied } = await authorizeAdmin("finance")
  if (denied) return denied
  if (!session) return err("Unauthorized", 401)
  if (!isSupabaseConfigured()) return err("Database not configured", 500)

  try {
    const body = await request.json()
    const { resource, action } = body as { resource: string; action?: string }
    const now = () => new Date().toISOString()
    const canManage = hasFinanceAction(session.role, "finance:accounts:manage")

    /* ── chart of accounts ── */
    if (resource === "gl-accounts") {
      if (!canManage) return err("Forbidden", 403)
      if (action === "create") {
        const { code, name, type, subtype, description } = body
        if (!code || !name || !type) return err("code, name and type are required")
        if (!["ASSET", "LIABILITY", "EQUITY", "INCOME", "EXPENSE"].includes(type)) return err("Invalid account type")
        const { data, error } = await supabase
          .from("gl_accounts")
          .insert({ code: String(code).trim(), name: name.trim(), type, subtype: subtype || null, description: description || null, active: true, is_system: false, created_at: now(), updated_at: now() })
          .select()
          .single()
        if (error) return err(error.message.includes("unique") ? "An account with that code already exists" : error.message, 500)
        return ok(data)
      }
      if (action === "update") {
        const { id, ...updates } = body
        if (!id) return err("Account ID required")
        delete updates.resource; delete updates.action; delete updates.id
        const { data, error } = await supabase.from("gl_accounts").update({ ...updates, updated_at: now() }).eq("id", id).select().single()
        if (error) return err(error.message, 500)
        return ok(data)
      }
      if (action === "set_active" || action === "set_inactive") {
        const { data, error } = await supabase.from("gl_accounts").update({ active: action === "set_active", updated_at: now() }).eq("id", body.id).select().single()
        if (error) return err(error.message, 500)
        return ok(data)
      }
    }

    /* ── payment (bank/cash) accounts ── */
    if (resource === "payment-accounts") {
      if (!canManage) return err("Forbidden", 403)
      if (action === "create") {
        const { name, payment_method, bank_name, account_number_last4, currency, opening_balance, opening_balance_date, is_default } = body
        if (!name) return err("Account name is required")

        // Create a matching GL account (subtype BANK / CASH) automatically.
        const { data: top } = await supabase.from("gl_accounts").select("code").gte("code", "1060").lte("code", "1199").order("code", { ascending: false }).limit(1)
        const nextCode = String(Math.min((top?.[0]?.code ? Number.parseInt(top[0].code as string, 10) : 1050) + 10, 1199))
        const { data: gl, error: glErr } = await supabase.from("gl_accounts").insert({
          code: nextCode,
          name: name.trim(),
          type: "ASSET",
          subtype: payment_method === "CASH" ? "CASH" : "BANK",
          active: true,
          created_at: now(),
          updated_at: now(),
        }).select().single()
        if (glErr) return err(glErr.message, 500)

        if (is_default) {
          await supabase.from("payment_accounts").update({ is_default: false }).eq("is_default", true)
        }
        const { data, error } = await supabase.from("payment_accounts").insert({
          name: name.trim(),
          gl_account_id: (gl as { id: string }).id,
          payment_method: payment_method || null,
          bank_name: bank_name || null,
          account_number_last4: account_number_last4 || null,
          currency: currency || "NGN",
          opening_balance: Number(opening_balance) || 0,
          opening_balance_date: opening_balance_date || null,
          is_default: Boolean(is_default),
          active: true,
          created_at: now(),
          updated_at: now(),
        }).select().single()
        if (error) {
          if (error.message.includes("unique")) return err("An account with that name or method mapping already exists", 409)
          return err(error.message, 500)
        }
        await postOpeningBalance((data as { id: string }).id, session.userId)
        return ok(data)
      }
      if (action === "update") {
        const { id, is_default, opening_balance, ...rest } = body
        if (!id) return err("Account ID required")
        delete rest.resource; delete rest.action
        if (is_default) await supabase.from("payment_accounts").update({ is_default: false }).eq("is_default", true)
        const updateData: Record<string, unknown> = { ...rest, updated_at: now() }
        if (is_default !== undefined) updateData.is_default = Boolean(is_default)
        const { data, error } = await supabase.from("payment_accounts").update(updateData).eq("id", id).select().single()
        if (error) return err(error.message, 500)
        // Repost opening balance if it changed.
        if (opening_balance !== undefined) {
          await supabase.from("payment_accounts").update({ opening_balance: Number(opening_balance) || 0 }).eq("id", id)
          await voidEntriesForSource("OPENING", id)
          await postOpeningBalance(id, session.userId)
        }
        return ok(data)
      }
      if (action === "set_active" || action === "set_inactive") {
        const { data, error } = await supabase.from("payment_accounts").update({ active: action === "set_active", updated_at: now() }).eq("id", body.id).select().single()
        if (error) return err(error.message, 500)
        return ok(data)
      }
    }

    /* ── transfer between payment accounts ── */
    if (resource === "transfer") {
      if (!canManage) return err("Forbidden", 403)
      const { from_account_id, to_account_id, amount, memo, entry_date } = body
      if (!from_account_id || !to_account_id) return err("Both accounts are required")
      if (from_account_id === to_account_id) return err("Cannot transfer to the same account")
      const entry = await postTransferJournal({ from_account_id, to_account_id, amount: Number(amount), memo, entry_date, created_by: session.userId })
      return ok(entry)
    }

    /* ── deposit into a payment account ── */
    if (resource === "deposit") {
      if (!canManage) return err("Forbidden", 403)
      const { payment_account_id, amount, income_category, memo, entry_date } = body
      if (!payment_account_id) return err("Account required")
      const entry = await postDepositJournal({ payment_account_id, amount: Number(amount), income_category, memo, entry_date, created_by: session.userId })
      return ok(entry)
    }

    /* ── manual journal entries ── */
    if (resource === "journal") {
      if (!canManage) return err("Forbidden", 403)
      if (action === "create") {
        const { entry_date, memo, lines } = body as { entry_date?: string; memo?: string; lines: JournalLineInput[] }
        const invalid = validateJournalLines(lines || [])
        if (invalid) return err(invalid)
        const entry = await postJournalEntry({ entry_date, memo, source_type: "MANUAL", lines, created_by: session.userId })
        return ok(entry)
      }
      if (action === "void") {
        if (!body.id) return err("Entry ID required")
        const { data, error } = await supabase.from("journal_entries").update({ status: "VOID" }).eq("id", body.id).eq("status", "POSTED").select().single()
        if (error) return err(error.message, 500)
        return ok(data)
      }
    }

    /* ── assign a payment to a deposit account & (re)post ── */
    if (resource === "payment-account") {
      if (!hasFinanceAction(session.role, "finance:payments:record")) return err("Forbidden", 403)
      const { payment_id, payment_account_id } = body
      if (!payment_id) return err("Payment ID required")
      const { error } = await supabase.from("payments").update({ payment_account_id: payment_account_id || null, journal_entry_id: null, updated_at: now() }).eq("id", payment_id)
      if (error) return err(error.message, 500)
      await voidEntriesForSource("PAYMENT", payment_id)
      try { await postPaymentJournal(payment_id) } catch (e) { console.error("[ledger] repost payment", e) }
      return ok({ success: true })
    }

    /* ── backfill journal for pre-ledger records ── */
    if (resource === "backfill") {
      if (!canManage) return err("Forbidden", 403)
      const counts = await backfillLedger(session.userId)
      return ok(counts)
    }

    return err("Unknown resource or action", 404)
  } catch (e) {
    console.error("[finance/ledger] POST", e)
    return err(String(e), 500)
  }
}
