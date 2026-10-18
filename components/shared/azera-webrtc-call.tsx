"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { Phone, PhoneOff, Mic, MicOff, Loader2, User, FileAudio } from "lucide-react"

interface UseWebRTCCallProps {
  callId: string
  enabled?: boolean
  isAgent: boolean
  localStream?: MediaStream
  remoteAudioEl?: HTMLAudioElement
  onCallEnded?: () => void
  onCallError?: (msg: string) => void
  onStartRecording?: () => void
  onStopRecording?: () => void
}

interface SignalingMessage {
  id: string
  event_type: string
  actor_type: string
  metadata: any
  created_at: string
}

/**
 * useWebRTCCall — manages a browser-to-browser audio call via Supabase signaling.
 *
 * Returns:
 *   state: "idle" | "connecting" | "ringing" | "active" | "ended" | "error"
 *   localStream, remoteStream
 *   startCall() — create offer (caller)
 *   answerCall() — create answer (callee)
 *   endCall() — hang up
 *   toggleMute()
 */
export function useWebRTCCall({
  callId,
  enabled = true,
  isAgent,
  localStream,
  remoteAudioEl,
  onCallEnded,
  onCallError,
  onStartRecording,
  onStopRecording,
}: UseWebRTCCallProps) {
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const localStreamRef = useRef<MediaStream | null>(localStream || null)
  const remoteStreamRef = useRef<MediaStream | null>(null)
  const [state, setState] = useState<"idle" | "connecting" | "ringing" | "active" | "ended" | "error">("idle")
  const [error, setError] = useState<string | null>(null)
  const [isMuted, setIsMuted] = useState(false)
  const iceCandidatesRef = useRef<RTCIceCandidate[]>([])

  const STUN_SERVERS = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ]

  const createPeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection({ iceServers: STUN_SERVERS })

    // Remote stream
    pc.ontrack = (event) => {
      remoteStreamRef.current = event.streams[0]
      if (remoteAudioEl && event.track.kind === "audio") {
        remoteAudioEl.srcObject = event.streams[0]
        remoteAudioEl.play().catch(() => {})
      }
    }

    // ICE candidates -> send via signaling
    pc.onicecandidate = (event) => {
      if (!event.candidate) return
      iceCandidatesRef.current.push(event.candidate)
      sendSignaling({
        event_type: "webrtc_ice_candidate",
        metadata: {
          candidate: event.candidate.candidate,
          sdp_mid: event.candidate.sdpMid,
          sdp_mline_index: event.candidate.sdpMLineIndex,
        },
      })
    }

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") {
        setState("active")
      } else if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
        setState("error")
        setError("Call connection lost")
      }
    }

    pcRef.current = pc
    return pc
  }, [remoteAudioEl])

  const sendSignaling = useCallback(
    async (msg: { event_type: string; metadata: any }) => {
      try {
        await fetch(`/api/azera/calls/${encodeURIComponent(callId)}/signaling`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(msg.metadata),
        })
      } catch (e) {
        console.error("[WebRTC] signaling send failed", e)
      }
    },
    [callId]
  )

  const fetchSignaling = useCallback(async () => {
    try {
      const res = await fetch(`/api/azera/calls/${encodeURIComponent(callId)}/signaling`)
      const json = await res.json()
      return (json.data || []) as SignalingMessage[]
    } catch {
      return []
    }
  }, [callId])

  const startCall = useCallback(async () => {
    if (!localStreamRef.current) {
      setError("Microphone not available")
      setState("error")
      return
    }
    setState("connecting")

    const pc = createPeerConnection()

    // Add local tracks
    localStreamRef.current.getTracks().forEach((track) => {
      pc.addTrack(track, localStreamRef.current!)
    })

    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)

    await sendSignaling({
      event_type: "webrtc_offer",
      metadata: { sdp_type: "offer", sdp: offer.sdp },
    })

    setState("ringing")
  }, [createPeerConnection, sendSignaling])

  const answerCall = useCallback(async () => {
    if (!localStreamRef.current) {
      setError("Microphone not available")
      setState("error")
      return
    }
    setState("connecting")

    const pc = createPeerConnection()

    localStreamRef.current.getTracks().forEach((track) => {
      pc.addTrack(track, localStreamRef.current!)
    })

    // Fetch pending offer from signaling
    const messages = await fetchSignaling()
    const offerMsg = messages.find((m) => m.event_type === "webrtc_offer")

    if (offerMsg && offerMsg.metadata.sdp) {
      const offer = new RTCSessionDescription({
        type: "offer",
        sdp: offerMsg.metadata.sdp,
      })
      await pc.setRemoteDescription(offer)

      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)

      await sendSignaling({
        event_type: "webrtc_answer",
        metadata: { sdp_type: "answer", sdp: answer.sdp },
      })
    }

    // Apply any queued ICE candidates
    for (const cand of iceCandidatesRef.current) {
      try {
        await pc.addIceCandidate(cand)
      } catch {}
    }

    setState("ringing")
  }, [createPeerConnection, fetchSignaling, sendSignaling])

  const endCall = useCallback(() => {
    pcRef.current?.close()
    pcRef.current = null
    localStreamRef.current?.getTracks().forEach((t) => t.stop())
    localStreamRef.current = null
    remoteStreamRef.current = null
    if (remoteAudioEl) remoteAudioEl.srcObject = null
    setState("ended")
    onCallEnded?.()
  }, [remoteAudioEl, onCallEnded])

  const toggleMute = useCallback(() => {
    localStreamRef.current?.getAudioTracks().forEach((t) => {
      t.enabled = !t.enabled
      setIsMuted(!t.enabled)
    })
  }, [])

  // Poll for incoming offer (callee side)
  useEffect(() => {
    if (!enabled || !callId || !isAgent && state !== "idle") return
    if (!isAgent && state === "idle") {
      const interval = setInterval(async () => {
        const messages = await fetchSignaling()
        const offerMsg = messages.find((m) => m.event_type === "webrtc_offer")
        if (offerMsg && state === "idle") {
          setState("ringing")
        }
      }, 2000)
      return () => clearInterval(interval)
    }
  }, [callId, enabled, isAgent, state, fetchSignaling])

  // Poll for answer (caller side)
  useEffect(() => {
    if (enabled && callId && state === "ringing") {
      const interval = setInterval(async () => {
        const messages = await fetchSignaling()
        const answerMsg = messages.find((m) => m.event_type === "webrtc_answer")
        if (answerMsg && answerMsg.metadata.sdp && pcRef.current) {
          try {
            const answer = new RTCSessionDescription({
              type: "answer",
              sdp: answerMsg.metadata.sdp,
            })
            await pcRef.current.setRemoteDescription(answer)
            setState("active")
          } catch (e) {
            console.error("[WebRTC] setRemoteDescription failed", e)
          }
        }
      }, 1500)
      return () => clearInterval(interval)
    }
  }, [callId, enabled, state, fetchSignaling])

  // Handle incoming ICE candidates
  useEffect(() => {
    if (!enabled || !callId || !pcRef.current) return
    const interval = setInterval(async () => {
      const messages = await fetchSignaling()
      const iceMsgs = messages.filter((m) => m.event_type === "webrtc_ice_candidate")
      for (const m of iceMsgs) {
        const { candidate, sdp_mid, sdp_mline_index } = m.metadata
        if (candidate && pcRef.current) {
          try {
            await pcRef.current.addIceCandidate({
              candidate,
              sdpMid: sdp_mid,
              sdpMLineIndex: sdp_mline_index,
            })
          } catch {}
        }
      }
    }, 1500)
    return () => clearInterval(interval)
  }, [callId, enabled, fetchSignaling])

  return {
    state,
    error,
    startCall,
    answerCall,
    endCall,
    toggleMute,
    onStartRecording,
    onStopRecording,
    isMuted,
  }
}

/**
 * AzeraCallUI — visual call widget (ringing/active/ended states).
 */
export function AzeraCallUI({
  state,
  isAgent = false,
  customerName = "Customer",
  onAccept,
  onReject,
  onEnd,
  onToggleMute,
  isMuted = false,
  onStartRecording,
  onStopRecording,
  isRecording = false,
}: {
  state: "idle" | "connecting" | "ringing" | "active" | "ended" | "error"
  isAgent?: boolean
  customerName?: string
  onAccept?: () => void
  onReject?: () => void
  onEnd?: () => void
  onToggleMute?: () => void
  isMuted?: boolean
  onStartRecording?: () => void
  onStopRecording?: () => void
  isRecording?: boolean
}) {
  const isRinging = state === "ringing"
  const isActive = state === "active"
  const isEnded = state === "ended"
  const isError = state === "error"

  if (state === "idle") return null

  return (
    <div className="fixed z-[60] top-24 left-1/2 -translate-x-1/2 w-full max-w-md bg-white rounded-2xl shadow-2xl border border-border p-4 flex flex-col items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-300">
      <div className="flex items-center gap-2">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
          isRinging ? "bg-blue-50 text-blue-600 animate-pulse" : "bg-retail text-white"
        }`}>
          <Phone className="w-5 h-5" />
        </div>
        <div>
          <div className="font-semibold text-sm">
            {isRinging ? "Incoming call" : isActive ? "Call active" : "Call ended"}
          </div>
          <div className="text-xs text-muted-foreground">{customerName}</div>
        </div>
      </div>

      {isRinging && (
        <div className="flex gap-2">
          <button
            onClick={onAccept}
            className="px-6 py-2 rounded-lg bg-green-600 text-white font-medium hover:bg-green-700 transition-colors"
          >
            Answer
          </button>
          <button
            onClick={onReject}
            className="px-6 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 transition-colors"
          >
            Decline
          </button>
        </div>
      )}

      {isActive && (
        <div className="flex gap-3">
          <button
            onClick={onToggleMute}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              isMuted ? "bg-red-100 text-red-600" : "bg-retail text-white hover:bg-retail/90"
            }`}
          >
            {isMuted ? <MicOff className="w-4 h-4 mr-1" /> : <Mic className="w-4 h-4 mr-1" />}
            {isMuted ? "Unmute" : "Mute"}
          </button>
          {isAgent && (
            <button
              onClick={isRecording ? onStopRecording : onStartRecording}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                isRecording ? "bg-red-100 text-red-600 animate-pulse" : "bg-retail text-white hover:bg-retail/90"
              }`}
            >
              {isRecording ? <FileAudio className="w-4 h-4 mr-1" /> : <FileAudio className="w-4 h-4 mr-1" />}
              {isRecording ? "Stop Recording" : "Record"}
            </button>
          )}
          <button
            onClick={onEnd}
            className="px-6 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 transition-colors"
          >
            <PhoneOff className="w-4 h-4 mr-1" /> Hang up
          </button>
        </div>
      )}

      {isEnded && (
        <div className="text-xs text-muted-foreground">Call ended</div>
      )}

      {isError && (
        <div className="text-xs text-red-500">Call error — please try again</div>
      )}
    </div>
  )
}
