"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import { CaptchaField, type CaptchaState, type CaptchaFieldHandle } from "@/components/captcha-field"

export default function CreatorLoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const captchaRef = useRef<CaptchaFieldHandle>(null)
  const [captcha, setCaptcha] = useState<CaptchaState>({ configured: false, token: null })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)
    const captchaToken = (await captchaRef.current?.execute()) ?? null
    if (captcha.configured && !captchaToken) {
      setError("Security check failed — please try again.")
      setLoading(false)
      return
    }
    try {
      const res = await fetch("/api/creator/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, captchaToken }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Invalid credentials")
        setLoading(false)
        return
      }
      router.push("/creator")
      router.refresh()
    } catch {
      setError("Something went wrong. Try again.")
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Creator Login</CardTitle>
          <CardDescription>MartPoint Creator Network</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-1">Email</label>
              <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-1">Password</label>
              <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <CaptchaField ref={captchaRef} onChange={setCaptcha} className="flex justify-center" />
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Sign In
            </Button>
          </form>
          <p className="text-center text-xs text-muted-foreground mt-4">
            <Link href="/creator/forgot-password" className="text-retail hover:underline">Forgot password?</Link>
          </p>
          <div className="mt-6 pt-4 border-t border-border text-center">
            <p className="text-xs text-muted-foreground">Not a creator yet?</p>
            <Link href="/creators/apply" className="text-sm font-medium text-retail hover:underline mt-1 inline-block">
              Apply to the Creator Network
            </Link>
          </div>
          <p className="text-center text-[11px] text-muted-foreground mt-3">
            Already applied?{" "}
            <Link href="/creators/application-status" className="text-retail hover:underline">
              Check your application status
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
