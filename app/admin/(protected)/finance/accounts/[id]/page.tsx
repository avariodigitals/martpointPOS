"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { ArrowLeft, Landmark, Loader2 } from "lucide-react"
import { GlStatement, formatMoney } from "@/components/admin/gl-statement"

type PaymentAccount = {
  id: string
  name: string
  gl_account_id: string
  payment_method?: string | null
  bank_name?: string | null
  account_number_last4?: string | null
  currency: string
  is_default: boolean
  active: boolean
  balance: number
  gl_accounts?: { code: string; name: string } | null
}

export default function PaymentAccountDetailPage() {
  const { id } = useParams() as { id: string }
  const [account, setAccount] = useState<PaymentAccount | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/admin/finance/ledger?resource=payment-accounts")
      .then((r) => r.json())
      .then((d) => {
        const list = (d.data || []) as PaymentAccount[]
        setAccount(list.find((a) => a.id === id) || null)
      })
      .catch(() => setAccount(null))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!account) {
    return (
      <div className="space-y-4">
        <Link href="/admin/finance/accounts" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="mr-1 h-4 w-4" /> Back to Accounts
        </Link>
        <p className="text-muted-foreground">Account not found.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/finance/accounts" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="mr-1 h-4 w-4" /> Back to Accounts
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <div className="rounded-lg bg-muted p-2">
            <Landmark className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">{account.name}</h2>
            <p className="text-sm text-muted-foreground">
              GL {account.gl_accounts?.code} · {account.gl_accounts?.name}
              {account.bank_name ? ` · ${account.bank_name}` : ""}
              {account.account_number_last4 ? ` ····${account.account_number_last4}` : ""}
              {account.payment_method ? ` · maps ${account.payment_method.replace(/_/g, " ")}` : ""}
              {account.is_default ? " · default" : ""}
            </p>
          </div>
          <div className="ml-auto text-right">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Balance</p>
            <p className="text-2xl font-bold">{formatMoney(account.balance)}</p>
          </div>
        </div>
      </div>

      <GlStatement paymentAccountId={account.id} />
    </div>
  )
}
