"use client"

import { useEffect, useState } from "react"
import { LiveKitRoom, RoomAudioRenderer, ControlBar } from "@livekit/components-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Phone, PhoneOff, Loader2, Radio } from "lucide-react"

interface InboundCall {
  room: string
  phone: string
  joinedAt: number
}

interface JoinedCall {
  room: string
  phone: string
  token: string
  url: string
}

export function LiveKitInboundPanel() {
  const [calls, setCalls] = useState<InboundCall[]>([])
  const [loading, setLoading] = useState(true)
  const [joined, setJoined] = useState<JoinedCall | null>(null)

  useEffect(() => {
    if (joined) return

    const load = async () => {
      try {
        const res = await fetch("/api/admin/livekit/calls")
        const data = await res.json()
        setCalls(data.calls || [])
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    load()
    const interval = setInterval(load, 3000)
    return () => clearInterval(interval)
  }, [joined])

  const pickUp = async (call: InboundCall) => {
    try {
      const res = await fetch("/api/admin/livekit/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ room: call.room }),
      })
      const data = await res.json()
      if (!res.ok || !data.token) {
        console.error(data.error || "Join failed")
        return
      }
      setJoined({ room: call.room, phone: call.phone, token: data.token, url: data.url })
    } catch (err) {
      console.error(err)
    }
  }

  const hangUp = () => {
    setJoined(null)
  }

  if (joined) {
    return (
      <div className="rounded-md border border-border bg-muted/20 p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-sm">
            <span className="font-medium">Call from {joined.phone}</span>
            <span className="text-muted-foreground ml-2 text-xs">Room: {joined.room}</span>
          </div>
          <Button size="sm" variant="default" className="bg-red-600 text-white hover:bg-red-700" onClick={hangUp}>
            <PhoneOff className="w-3.5 h-3.5 mr-1" /> End
          </Button>
        </div>
        <LiveKitRoom
          serverUrl={joined.url}
          token={joined.token}
          connect
          audio
          video={false}
          onDisconnected={hangUp}
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

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Radio className="w-4 h-4" />
          Inbound calls
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Listening…
          </div>
        ) : calls.length === 0 ? (
          <div className="text-sm text-muted-foreground">No inbound calls right now.</div>
        ) : (
          <div className="space-y-2">
            {calls.map((call) => (
              <div
                key={call.room}
                className="flex items-center justify-between rounded-md border border-border bg-muted/10 p-3"
              >
                <div>
                  <p className="text-sm font-medium flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5" /> {call.phone}
                  </p>
                  <p className="text-xs text-muted-foreground">Started at {new Date(call.joinedAt).toLocaleTimeString()}</p>
                </div>
                <Button size="sm" variant="default" onClick={() => pickUp(call)}>
                  <Phone className="w-3.5 h-3.5 mr-1" /> Pick up
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
