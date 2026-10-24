"use client"

import { useWebRTCCall, AzeraCallUI } from "@/components/shared/azera-webrtc-call"

interface AzeraCallControllerProps {
  callId: string
  customerName: string
  authToken: string | null
  localStream: MediaStream
  onEnded: () => void
}

/** Load the WebRTC layer only after a visitor requests a call. */
export function AzeraCallController({ callId, customerName, authToken, localStream, onEnded }: AzeraCallControllerProps) {
  const webrtc = useWebRTCCall({
    callId,
    enabled: true,
    isAgent: false,
    authToken,
    localStream,
    onCallEnded: onEnded,
  })
  return (
    <AzeraCallUI
      state={webrtc.state}
      error={webrtc.error}
      audioBlocked={webrtc.audioBlocked}
      onResumeAudio={webrtc.resumeAudio}
      isAgent={false}
      customerName={customerName}
      outgoing
      onReject={() => void webrtc.endCall()}
      onEnd={() => void webrtc.endCall()}
      onToggleMute={webrtc.toggleMute}
      isMuted={webrtc.isMuted}
    />
  )
}
