import { NextResponse } from "next/server"
import { isAdminAuthenticated } from "@/lib/admin-auth"
import {
  readFinanceData,
  writeFinanceData,
  calculateSummary,
  type FinanceTransaction,
} from "@/lib/finance"
import crypto from "crypto"

/* ─── GET ─── */
export async function GET(request: Request) {
  const authenticated = await isAdminAuthenticated()
  if (!authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get("action") || "list"

    if (action === "summary") {
      const summary = calculateSummary()
      return NextResponse.json({ success: true, summary })
    }

    const finance = readFinanceData()
    return NextResponse.json({ success: true, transactions: finance.transactions, settings: finance.settings })
  } catch {
    return NextResponse.json({ error: "Failed to load finance data" }, { status: 500 })
  }
}

/* ─── POST (create transaction) ─── */
export async function POST(request: Request) {
  const authenticated = await isAdminAuthenticated()
  if (!authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { type, category, subcategory, amount, tax, description, date, leadId, account, recurring, frequency } = body

    if (!type || !category || typeof amount !== "number" || !description || !date) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const finance = readFinanceData()

    const txn: FinanceTransaction = {
      id: crypto.randomUUID(),
      type,
      category,
      subcategory: subcategory || "",
      amount: Math.abs(amount),
      tax: typeof tax === "number" ? Math.abs(tax) : undefined,
      description,
      date,
      leadId: leadId || "",
      account: account || "",
      recurring: recurring || false,
      frequency: frequency || "one-time",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    finance.transactions.unshift(txn)
    writeFinanceData(finance)

    return NextResponse.json({ success: true, transaction: txn })
  } catch {
    return NextResponse.json({ error: "Failed to create transaction" }, { status: 500 })
  }
}

/* ─── PUT (update) ─── */
export async function PUT(request: Request) {
  const authenticated = await isAdminAuthenticated()
  if (!authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { id, type, category, subcategory, amount, tax, description, date, leadId, account, recurring, frequency } = body

    if (!id) {
      return NextResponse.json({ error: "Transaction ID required" }, { status: 400 })
    }

    const finance = readFinanceData()
    const idx = finance.transactions.findIndex((t) => t.id === id)
    if (idx === -1) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 })
    }

    if (type !== undefined) finance.transactions[idx].type = type
    if (category !== undefined) finance.transactions[idx].category = category
    if (subcategory !== undefined) finance.transactions[idx].subcategory = subcategory
    if (amount !== undefined) finance.transactions[idx].amount = Math.abs(amount)
    if (tax !== undefined) finance.transactions[idx].tax = Math.abs(tax)
    if (description !== undefined) finance.transactions[idx].description = description
    if (date !== undefined) finance.transactions[idx].date = date
    if (leadId !== undefined) finance.transactions[idx].leadId = leadId
    if (account !== undefined) finance.transactions[idx].account = account
    if (recurring !== undefined) finance.transactions[idx].recurring = recurring
    if (frequency !== undefined) finance.transactions[idx].frequency = frequency
    finance.transactions[idx].updatedAt = new Date().toISOString()

    writeFinanceData(finance)
    return NextResponse.json({ success: true, transaction: finance.transactions[idx] })
  } catch {
    return NextResponse.json({ error: "Failed to update transaction" }, { status: 500 })
  }
}

/* ─── DELETE ─── */
export async function DELETE(request: Request) {
  const authenticated = await isAdminAuthenticated()
  if (!authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json({ error: "Transaction ID required" }, { status: 400 })
    }

    const finance = readFinanceData()
    const filtered = finance.transactions.filter((t) => t.id !== id)
    if (filtered.length === finance.transactions.length) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 })
    }

    finance.transactions = filtered
    writeFinanceData(finance)
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Failed to delete transaction" }, { status: 500 })
  }
}
