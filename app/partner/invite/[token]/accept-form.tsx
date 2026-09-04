"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"

export function AcceptInvitationForm({
  token,
  partnerName,
  fullName,
  email,
}: {
  token: string
  partnerName: string
  fullName: string
  email: string
}) {
  const router = useRouter()
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    if (password.length < 10) { setError("Password must be at least 10 characters."); return }
    if (password !== confirm) { setError("Passwords do not match."); return }

    setLoading(true)
    try {
      const res = await fetch("/api/partner/invitations/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      })
      const data = await res.json()
      if (res.ok) {
        router.push("/partner")
        router.refresh()
      } else {
        setError(data.error || "Failed to accept invitation.")
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Accept Invitation</CardTitle>
        <CardDescription>
          You have been invited to join {partnerName || "a MartPoint partner"}.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-center text-muted-foreground mb-4">{fullName} · {email}</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Create Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Confirm Password</label>
            <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Accept & Set Password
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
