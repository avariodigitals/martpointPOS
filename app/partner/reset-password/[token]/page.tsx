"use client"

import { useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"

export default function PartnerResetPasswordPage() {
  const router = useRouter()
  const { token } = useParams() as { token: string }
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setMessage("")
    if (password.length < 10) { setError("Password must be at least 10 characters."); return }
    if (password !== confirm) { setError("Passwords do not match."); return }

    setLoading(true)
    try {
      const res = await fetch("/api/partner/password/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      })
      const data = await res.json()
      if (res.ok) {
        setMessage("Password reset successfully. Redirecting to login...")
        setTimeout(() => router.push("/partner/login"), 1500)
      } else {
        setError(data.error || "Failed to reset password.")
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Reset Password</CardTitle>
          <CardDescription>Set a new partner portal password</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">New Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Confirm Password</label>
              <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            {message && <p className="text-sm text-green-600">{message}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Reset Password
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
