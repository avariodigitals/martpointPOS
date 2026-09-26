"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { ArrowLeft, Loader2, Scale } from "lucide-react"
import { GlStatement, formatMoney } from "@/components/admin/gl-statement"

type GlAccount = {
  id: string
  code: string
  name: string
  type: string
  subtype?: string | null
  balance: number
}

export default function GlAccountDetailPage() {
  const { id } = useParams() as { id: string }
  const [account, setAccount] = useState<GlAccount | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/admin/finance/ledger?resource=gl-accounts")
      .then((r) => r.json())
      .then((d) => {
        const list = (d.data || []) as GlAccount[]
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
        <Link href="/admin/finance/chart-of-accounts" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="mr-1 h-4 w-4" /> Back to Chart of Accounts
        </Link>
        <p className="text-muted-foreground">Account not found.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/finance/chart-of-accounts" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="mr-1 h-4 w-4" /> Back to Chart of Accounts
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <div className="rounded-lg bg-muted p-2">
            <Scale className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">
              {account.code} · {account.name}
            </h2>
            <p className="text-sm text-muted-foreground">
              {account.type}
              {account.subtype ? ` · ${account.subtype.replace(/_/g, " ")}` : ""}
            </p>
          </div>
          <div className="ml-auto text-right">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Balance</p>
            <p className="text-2xl font-bold">{formatMoney(account.balance)}</p>
          </div>
        </div>
      </div>

      <GlStatement glAccountId={account.id} />
    </div>
  )
}
