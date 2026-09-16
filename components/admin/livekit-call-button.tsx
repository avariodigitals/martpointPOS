"use client"

import { useState } from "react"
import { LiveKitRoom, RoomAudioRenderer, ControlBar } from "@livekit/components-react"
import { Button } from "@/components/ui/button"
import { Phone, PhoneOff, Loader2 } from "lucide-react"

interface LiveKitCallButtonProps {
  customerId: string
  phone: string
}

type CallState = "idle" | "dialing" | "connected" | "error"

interface Call {
  room: string
  token: string
  url: string
  phone: string
}

export function LiveKitCallButton({ customerId, phone }: LiveKitCallButtonProps) {
  const [state, setState] = useState<CallState>("idle")
  const [call, setCall] = useState<Call | null>(null)

  const start = async () => {
    setState("dialing")
    try {
      const res = await fetch("/api/admin/livekit/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId, phone }),
      })
      const data = await res.json()
      if (!res.ok || !data.token) {
        console.error(data.error || "Call failed")
        setState("error")
        return
      }
      setCall(data)
      setState("connected")
    } catch (err) {
      console.error(err)
      setState("error")
    }
  }

  const stop = () => {
    setCall(null)
    setState("idle")
  }

  if (state === "idle") {
    return (
      <Button size="sm" variant="outline" onClick={start}>
        <Phone className="w-3.5 h-3.5 mr-1" /> Call
      </Button>
    )
  }

  if (state === "dialing") {
    return (
      <Button size="sm" disabled>
        <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> Dialing…
      </Button>
    )
  }

  if (state === "error") {
    return (
      <Button size="sm" variant="default" className="bg-red-600 text-white hover:bg-red-700" onClick={start}>
        <Phone className="w-3.5 h-3.5 mr-1" /> Retry call
      </Button>
    )
  }

  if (!call) return null

  return (
    <div className="rounded-md border border-border bg-muted/20 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-sm">
          <span className="font-medium">Calling {call.phone}</span>
          <span className="text-muted-foreground ml-2 text-xs">Room: {call.room}</span>
        </div>
        <Button size="sm" variant="default" className="bg-red-600 text-white hover:bg-red-700" onClick={stop}>
          <PhoneOff className="w-3.5 h-3.5 mr-1" /> End
        </Button>
      </div>
      <LiveKitRoom
        serverUrl={call.url}
        token={call.token}
        connect
        audio
        video={false}
        onDisconnected={stop}
      >
        <RoomAudioRenderer />
        <ControlBar
          variation="minimal"
          controls={{ microphone: true, camera: false, screenShare: false, chat: false, leave: false, settings: false }}
        />
      </LiveKitRoom>
    </div>
  )
}
