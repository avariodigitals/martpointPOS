"use client"

import { useEffect, useRef } from "react"
import { useWebRTCCall, AzeraCallUI } from "@/components/shared/azera-webrtc-call"

interface AzeraCallControllerProps {
  callId: string
  customerName: string
  authToken: string | null
  onEnded: () => void
}

/** Load the WebRTC layer only after a visitor requests a call. */
export function AzeraCallController({ callId, customerName, authToken, onEnded }: AzeraCallControllerProps) {
  const webrtc = useWebRTCCall({
    callId,
    enabled: true,
    isAgent: false,
    authToken,
    onCallEnded: onEnded,
  })
  const { startCall } = webrtc
  const startedRef = useRef(false)

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true
    void startCall()
  }, [startCall])

  return (
    <AzeraCallUI
      state={webrtc.state}
      isAgent={false}
      customerName={customerName}
      outgoing
      onReject={webrtc.endCall}
      onEnd={webrtc.endCall}
      onToggleMute={webrtc.toggleMute}
      isMuted={webrtc.isMuted}
    />
  )
}
