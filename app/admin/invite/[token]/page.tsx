"use client"

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"

export default function AdminInvitePage() {
  const params = useParams<{ token: string }>()
  const router = useRouter()
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    if (password.length < 8) return setError("Password must be at least 8 characters.")
    if (password !== confirm) return setError("Passwords do not match.")
    setSaving(true)
    try {
      const res = await fetch("/api/admin/invite/accept", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: params.token, password }) })
      const data = await res.json()
      if (!res.ok) return setError(data.error || "Invitation could not be activated.")
      router.push(`/admin/login?username=${encodeURIComponent(data.username)}&invited=1`)
    } catch {
      setError("Network error. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-lg border bg-card p-6 shadow-sm space-y-4">
        <div><h1 className="text-xl font-semibold">Set up your MartPoint account</h1><p className="text-sm text-muted-foreground mt-1">Choose a password to activate your admin access.</p></div>
        <label className="block text-sm">Password<input className="mt-1 w-full rounded-md border px-3 py-2" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
        <label className="block text-sm">Confirm password<input className="mt-1 w-full rounded-md border px-3 py-2" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required /></label>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button className="w-full" type="submit" disabled={saving}>{saving ? "Activating…" : "Activate account"}</Button>
      </form>
    </main>
  )
}
