import Link from "next/link"
import { redirect } from "next/navigation"
import { ArrowRight, Mail, ShieldCheck, UserCircle } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getSession, getUserById } from "@/lib/admin-auth"

export const dynamic = "force-dynamic"

export default async function AdminProfilePage() {
  const session = await getSession()
  if (!session) redirect("/admin/login?expired=1")

  const user = await getUserById(session.userId)

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-retail">Account</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">My Profile</h1>
        <p className="mt-1 text-sm text-slate-500">Your administrator identity and access details.</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.35fr_0.65fr]">
        <Card className="overflow-hidden rounded-2xl border-slate-200/80 shadow-sm">
          <CardHeader className="border-b border-slate-100 bg-white pb-5">
            <div className="flex items-center gap-4">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-retail-soft text-lg font-bold text-retail">
                {(session.name || session.username).slice(0, 2).toUpperCase()}
              </span>
              <div>
                <CardTitle className="text-xl">{session.name || session.username}</CardTitle>
                <p className="mt-1 text-sm text-slate-500">{session.role} · {session.username}</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 p-6 sm:grid-cols-2">
            <div className="rounded-xl bg-slate-50 p-4">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500"><UserCircle className="h-4 w-4" /> Username</div>
              <p className="mt-2 break-all text-sm font-medium text-slate-900">{session.username}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-4">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500"><Mail className="h-4 w-4" /> Email</div>
              <p className="mt-2 break-all text-sm font-medium text-slate-900">{user?.email || "Not set"}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-4 sm:col-span-2">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500"><ShieldCheck className="h-4 w-4" /> Access level</div>
              <p className="mt-2 text-sm font-medium text-slate-900">{session.role}</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">Your access is governed by the Control Centre role assigned to this account.</p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-200/80 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Account actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link href="/admin/settings" className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-retail/30 hover:bg-retail-soft/40 hover:text-slate-950">
              Workspace settings <ArrowRight className="h-4 w-4 text-slate-400" />
            </Link>
            <Link href="/admin/users" className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-retail/30 hover:bg-retail-soft/40 hover:text-slate-950">
              Manage team members <ArrowRight className="h-4 w-4 text-slate-400" />
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
