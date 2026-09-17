"use client"

import { Suspense, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Loader2, CheckCircle2, AlertCircle, Mail } from "lucide-react"

function UnsubscribeForm() {
  const searchParams = useSearchParams()
  const token = searchParams.get("t") || ""

  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle")

  const unsubscribe = async () => {
    setState("loading")
    try {
      const res = await fetch("/api/marketing/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      })
      setState(res.ok ? "done" : "error")
    } catch {
      setState("error")
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardContent className="p-8 text-center space-y-4">
        {state === "done" ? (
          <>
            <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto" />
            <h1 className="text-xl font-semibold">You&apos;re unsubscribed</h1>
            <p className="text-sm text-muted-foreground">
              You will no longer receive marketing emails from MartPoint.
              You may still receive important transactional messages about your account.
            </p>
          </>
        ) : (
          <>
            <Mail className="w-12 h-12 text-muted-foreground mx-auto" />
            <h1 className="text-xl font-semibold">Unsubscribe from MartPoint emails</h1>
            {token ? (
              <>
                <p className="text-sm text-muted-foreground">
                  Click below to stop receiving marketing emails from MartPoint.
                </p>
                <Button onClick={unsubscribe} disabled={state === "loading"} className="w-full">
                  {state === "loading" && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Confirm unsubscribe
                </Button>
                {state === "error" && (
                  <p className="text-sm text-red-500 flex items-center justify-center gap-1">
                    <AlertCircle className="w-4 h-4" /> This link is invalid or has expired.
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm text-red-500 flex items-center justify-center gap-1">
                <AlertCircle className="w-4 h-4" /> Invalid unsubscribe link.
              </p>
            )}
          </>
        )}
        <p className="text-xs text-muted-foreground">MartPoint &middot; martpoint.com.ng</p>
      </CardContent>
    </Card>
  )
}

export default function UnsubscribePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Suspense
        fallback={
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        }
      >
        <UnsubscribeForm />
      </Suspense>
    </div>
  )
}
