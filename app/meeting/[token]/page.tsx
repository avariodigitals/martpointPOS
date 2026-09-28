"use client"

import { useCallback, useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, Video, Calendar, Clock, AlertCircle, CheckCircle2, RefreshCw } from "lucide-react"
import { SlotPicker } from "@/components/shared/slot-picker"

const LOAD_TIMEOUT_MS = 20_000

interface Meeting {
  title: string
  scheduledAt: string | null
  durationMinutes: number
  timezone: string
  meetingLink: string | null
  provider: string | null
  status: "PENDING" | "SCHEDULED" | "COMPLETED" | "CANCELLED" | "NO_SHOW"
  leadFullName: string
  leadBusinessName: string
  leadPhone: string
  leadTimezone: string | null
  expiresAt: string | null
  hasProposedSlots: boolean
}

function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "Africa/Lagos"
  } catch {
    return "Africa/Lagos"
  }
}

export default function CustomerMeetingPage() {
  const { token } = useParams() as { token: string }
  const [meeting, setMeeting] = useState<Meeting | null>(null)
  const [slots, setSlots] = useState<string[]>([])
  const [expired, setExpired] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  // Only read after the loader is gone, so a server/client mismatch can't leak into markup.
  const [tz, setTz] = useState(() => (typeof window === "undefined" ? "Africa/Lagos" : browserTimeZone()))
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)
  const [booking, setBooking] = useState(false)
  const [bookError, setBookError] = useState("")
  const [justBooked, setJustBooked] = useState(false)
  const [meetPending, setMeetPending] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/meetings/${token}`, { cache: "no-store", signal: AbortSignal.timeout(LOAD_TIMEOUT_MS) })
      const data = await res.json()
      if (data.meeting) {
        setMeeting(data.meeting)
        setSlots(data.availableSlots || [])
        setExpired(Boolean(data.expired))
        setError("")
      } else {
        setError(data.error || "Meeting not found")
      }
    } catch {
      setError("This is taking longer than usual — please check your connection and retry.")
    }
  }, [token])

  const retry = () => {
    setLoading(true)
    setError("")
    void load().finally(() => setLoading(false))
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch
    void load().finally(() => setLoading(false))
  }, [load])

  const confirm = async () => {
    if (!selectedSlot) return
    setBooking(true)
    setBookError("")
    try {
      const res = await fetch(`/api/meetings/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slot: selectedSlot, timezone: tz }),
      })
      const data = await res.json()
      if (data.success && data.meeting) {
        setMeeting(data.meeting)
        setJustBooked(true)
        setMeetPending(Boolean(data.meetPending))
      } else {
        setBookError(data.error || "Could not book that time. Please try another slot.")
        if (res.status === 409) {
          setSelectedSlot(null)
          await load()
        }
      }
    } catch {
      setBookError("Could not complete the booking. Please try again.")
    } finally {
      setBooking(false)
    }
  }

  const fmtFull = (iso: string, zone: string) =>
    new Date(iso).toLocaleString("en-GB", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: zone })

  const greetingName = meeting?.leadFullName || meeting?.leadBusinessName || "there"

  return (
    <>
      <Header />
      <main className="flex-1 bg-background">
        <section className="container-martpoint py-16">
          <div className="max-w-2xl mx-auto">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : error || !meeting ? (
              <Card className="border-destructive/20">
                <CardContent className="p-8 text-center space-y-4">
                  <AlertCircle className="w-10 h-10 text-destructive mx-auto" />
                  <p className="text-destructive font-medium">{error || "Meeting not found"}</p>
                  <Button variant="outline" size="sm" onClick={retry}>
                    <RefreshCw className="w-4 h-4 mr-1.5" /> Retry
                  </Button>
                </CardContent>
              </Card>
            ) : meeting.status === "PENDING" ? (
              /* ─── Slot picker ─── */
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-xl">{meeting.title}</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Hi {greetingName}, pick a time for a {meeting.durationMinutes}-minute Google Meet call with the MartPoint team.
                  </p>
                </CardHeader>
                <CardContent className="space-y-6">
                  {expired ? (
                    <div className="rounded-lg bg-destructive/10 text-destructive p-4 text-sm font-medium">
                      This invitation has expired. Please reply to our email and we&apos;ll send you a fresh one.
                    </div>
                  ) : (
                    <>
                      <SlotPicker
                        slots={slots}
                        timezone={tz}
                        onTimezoneChange={setTz}
                        timezoneOptions={[browserTimeZone(), meeting.timezone]}
                        selectedSlot={selectedSlot}
                        onSelect={setSelectedSlot}
                        emptyMessage="No open times are available right now. Please reply to our email and we'll find a time that works."
                      />

                      {slots.length > 0 && (
                        <>
                          {bookError && <p className="text-sm text-destructive">{bookError}</p>}

                          <div className="flex items-center justify-between gap-3 flex-wrap rounded-lg border border-border bg-muted/30 p-4">
                            <div className="text-sm">
                              {selectedSlot ? (
                                <>
                                  <p className="font-medium">{fmtFull(selectedSlot, tz)}</p>
                                  <p className="text-xs text-muted-foreground">{meeting.durationMinutes} minutes · {tz}</p>
                                </>
                              ) : (
                                <p className="text-muted-foreground">Select a time to continue</p>
                              )}
                            </div>
                            <Button onClick={confirm} disabled={!selectedSlot || booking}>
                              {booking ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <CheckCircle2 className="w-4 h-4 mr-1.5" />}
                              Confirm meeting
                            </Button>
                          </div>
                        </>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            ) : (
              /* ─── Scheduled / completed / cancelled ─── */
              <Card>
                <CardHeader className="pb-4">
                  {justBooked && (
                    <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-green-50 text-green-700 px-3 py-1 text-xs font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5" /> You&apos;re booked — a confirmation email is on its way.
                    </div>
                  )}
                  <CardTitle className="text-xl">{meeting.title}</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Hi {greetingName}, here are your meeting details.
                  </p>
                </CardHeader>
                <CardContent className="space-y-6">
                  {meeting.status === "CANCELLED" && (
                    <div className="rounded-lg bg-destructive/10 text-destructive p-4 text-sm font-medium">
                      This meeting has been cancelled. Please contact us to reschedule.
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex items-start gap-3">
                      <Calendar className="w-5 h-5 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-sm font-medium">Date & Time</p>
                        {meeting.scheduledAt ? (
                          <>
                            <p className="text-sm text-muted-foreground">{fmtFull(meeting.scheduledAt, tz)}</p>
                            <p className="text-xs text-muted-foreground">{tz}</p>
                          </>
                        ) : (
                          <p className="text-sm text-muted-foreground">To be confirmed</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Clock className="w-5 h-5 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-sm font-medium">Duration</p>
                        <p className="text-sm text-muted-foreground">{meeting.durationMinutes} minutes</p>
                      </div>
                    </div>
                  </div>

                  {meeting.meetingLink ? (
                    <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Video className="w-4 h-4" />
                        {meeting.provider ? `${meeting.provider} meeting` : "Meeting link"}
                      </div>
                      <Button asChild className="w-full" disabled={meeting.status === "CANCELLED"}>
                        <a href={meeting.meetingLink} target="_blank" rel="noopener noreferrer">
                          Join Meeting
                        </a>
                      </Button>
                      <p className="text-xs text-muted-foreground break-all">{meeting.meetingLink}</p>
                    </div>
                  ) : meeting.status !== "CANCELLED" ? (
                    <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
                      {meetPending
                        ? "Your time is confirmed. The video link is being set up and will be emailed to you shortly."
                        : "A meeting link will be added here shortly."}
                    </div>
                  ) : null}

                  <p className="text-xs text-muted-foreground">
                    Questions or need to reschedule? Reply to your confirmation email{meeting.leadPhone ? "" : " or call our support line"}.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
