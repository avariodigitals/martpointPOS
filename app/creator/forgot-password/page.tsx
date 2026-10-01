"use client"

import { useRef, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, CheckCircle2 } from "lucide-react"
import { CaptchaField, type CaptchaState, type CaptchaFieldHandle } from "@/components/captcha-field"

export default function CreatorForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const captchaRef = useRef<CaptchaFieldHandle>(null)
  const [captcha, setCaptcha] = useState<CaptchaState>({ configured: false, token: null })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const captchaToken = (await captchaRef.current?.execute()) ?? null
    if (captcha.configured && !captchaToken) {
      setLoading(false)
      return
    }
    try {
      await fetch("/api/creator/password/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, captchaToken }),
      })
      setSent(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Reset Password</CardTitle>
          <CardDescription>MartPoint Creator Network</CardDescription>
        </CardHeader>
        <CardContent>
          {sent ? (
            <div className="text-center space-y-3">
              <CheckCircle2 className="h-10 w-10 text-green-600 mx-auto" />
              <p className="text-sm text-muted-foreground">
                If an account exists for that email, a reset link is on its way.
              </p>
              <Link href="/creator/login" className="text-sm text-retail hover:underline">Back to login</Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
              </div>
              <CaptchaField ref={captchaRef} onChange={setCaptcha} className="flex justify-center" />
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Send Reset Link
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                <Link href="/creator/login" className="text-retail hover:underline">Back to login</Link>
              </p>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
