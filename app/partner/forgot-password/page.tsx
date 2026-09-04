"use client"

import { useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"

export default function PartnerForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMessage("")
    try {
      const res = await fetch("/api/partner/password/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
      if (res.ok) {
        setMessage("If an account exists, a reset link has been sent.")
      } else {
        setMessage("If an account exists, a reset link has been sent.")
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Forgot Password</CardTitle>
          <CardDescription>Reset your partner portal password</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-1">Email</label>
              <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
            {message && <p className="text-sm text-green-600">{message}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Send Reset Link
            </Button>
          </form>
          <p className="text-center text-xs text-muted-foreground mt-4">
            <Link href="/partner/login" className="text-retail hover:underline">Back to login</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
