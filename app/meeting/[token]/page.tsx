"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, Video, Calendar, Clock, AlertCircle } from "lucide-react"

interface Meeting {
  title: string
  scheduledAt: string
  durationMinutes: number
  timezone: string
  meetingLink: string | null
  provider: string | null
  status: "SCHEDULED" | "COMPLETED" | "CANCELLED" | "NO_SHOW"
  leadFullName: string
  leadBusinessName: string
  leadEmail: string
  leadPhone: string
}

export default function CustomerMeetingPage() {
  const { token } = useParams() as { token: string }
  const [meeting, setMeeting] = useState<Meeting | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    fetch(`/api/meetings/${token}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.meeting) {
          setMeeting(data.meeting)
        } else {
          setError(data.error || "Meeting not found")
        }
      })
      .catch(() => setError("Failed to load meeting details"))
      .finally(() => setLoading(false))
  }, [token])

  return (
    <>
      <Header />
      <main className="flex-1 bg-background">
        <section className="container-martpoint py-16">
          <div className="max-w-xl mx-auto">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : error || !meeting ? (
              <Card className="border-destructive/20">
                <CardContent className="p-8 text-center space-y-4">
                  <AlertCircle className="w-10 h-10 text-destructive mx-auto" />
                  <p className="text-destructive font-medium">{error || "Meeting not found"}</p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-xl">{meeting.title}</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Hi {meeting.leadFullName || meeting.leadBusinessName || "there"}, here is your scheduled meeting link.
                  </p>
                </CardHeader>
                <CardContent className="space-y-6">
                  {meeting.status === "CANCELLED" ? (
                    <div className="rounded-lg bg-destructive/10 text-destructive p-4 text-sm font-medium">
                      This meeting has been cancelled. Please contact us to reschedule.
                    </div>
                  ) : null}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex items-start gap-3">
                      <Calendar className="w-5 h-5 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-sm font-medium">Date & Time</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(meeting.scheduledAt).toLocaleString("en-GB", {
                            dateStyle: "medium",
                            timeStyle: "short",
                            timeZone: meeting.timezone,
                          })}
                        </p>
                        <p className="text-xs text-muted-foreground">{meeting.timezone}</p>
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
                      <Button asChild className="w-full">
                        <a href={meeting.meetingLink} target="_blank" rel="noopener noreferrer">
                          Join Meeting
                        </a>
                      </Button>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
                      A meeting link will be added here shortly.
                    </div>
                  )}

                  <p className="text-xs text-muted-foreground">
                    Questions? Reply to your confirmation email or call {meeting.leadPhone || "our support line"}.
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
