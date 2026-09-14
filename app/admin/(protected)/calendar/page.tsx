"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, ChevronLeft, ChevronRight, Video, Calendar, Clock } from "lucide-react"

interface CalendarMeeting {
  id: string
  leadId: string
  customerToken: string
  title: string
  scheduledAt: string
  durationMinutes: number
  timezone: string
  meetingLink: string | null
  provider: string | null
  status: "SCHEDULED" | "COMPLETED" | "CANCELLED" | "NO_SHOW"
  notes: string | null
  leadFullName: string
  leadBusinessName: string
  leadEmail: string
  leadPhone: string
}

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

function formatMonthYear(d: Date) {
  return d.toLocaleDateString("en-GB", { month: "long", year: "numeric" })
}

function dateKey(d: Date) {
  return d.toISOString().split("T")[0]
}

function meetingDateKey(scheduledAt: string) {
  return new Date(scheduledAt).toISOString().split("T")[0]
}

export default function AdminCalendarPage() {
  const [today] = useState(() => new Date())
  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const [meetings, setMeetings] = useState<CalendarMeeting[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Date | null>(null)

  useEffect(() => {
    setLoading(true)
    const start = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1)
    const end = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0, 23, 59, 59)
    fetch(`/api/admin/calendar?from=${start.toISOString()}&to=${end.toISOString()}`)
      .then((res) => res.json())
      .then((data) => {
        setMeetings(data.meetings || [])
      })
      .catch(() => setMeetings([]))
      .finally(() => setLoading(false))
  }, [viewDate])

  const calendarGrid = useMemo(() => {
    const year = viewDate.getFullYear()
    const month = viewDate.getMonth()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const firstDay = new Date(year, month, 1).getDay()
    const startOffset = (firstDay + 6) % 7
    const days: { date: Date; current: boolean }[] = []
    for (let i = 0; i < startOffset; i++) {
      const d = new Date(year, month, 1 - startOffset + i)
      days.push({ date: d, current: false })
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({ date: new Date(year, month, i), current: true })
    }
    const remainder = (7 - (days.length % 7)) % 7
    for (let i = 1; i <= remainder; i++) {
      days.push({ date: new Date(year, month + 1, i), current: false })
    }
    return days
  }, [viewDate])

  const meetingsByDate = useMemo(() => {
    const map = new Map<string, CalendarMeeting[]>()
    for (const m of meetings) {
      const key = meetingDateKey(m.scheduledAt)
      if (!map.has(key)) map.set(key, [])
      map.get(key)?.push(m)
    }
    return map
  }, [meetings])

  const selectedMeetings = selected ? meetingsByDate.get(dateKey(selected)) || [] : []

  const nextMonth = () => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))
  const prevMonth = () => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Meeting Calendar
          </h2>
          <p className="text-muted-foreground">Track scheduled lead meetings and demos.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={prevMonth}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm font-semibold min-w-[140px] text-center">{formatMonthYear(viewDate)}</span>
          <Button variant="outline" size="sm" onClick={nextMonth}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardContent className="p-4">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="grid grid-cols-7 gap-1">
                {DAY_NAMES.map((d) => (
                  <div key={d} className="text-center text-xs font-semibold text-muted-foreground py-2">
                    {d}
                  </div>
                ))}
                {calendarGrid.map(({ date, current }, idx) => {
                  const key = dateKey(date)
                  const dayMeetings = meetingsByDate.get(key) || []
                  const isSelected = selected ? dateKey(selected) === key : false
                  return (
                    <button
                      key={idx}
                      onClick={() => setSelected(date)}
                      className={`min-h-[80px] rounded-lg border p-2 text-left transition-colors ${
                        current ? "bg-background" : "bg-muted/40 text-muted-foreground"
                      } ${isSelected ? "border-retail ring-1 ring-retail" : "border-border hover:border-retail/40"}`}
                    >
                      <span className="text-sm font-medium">{date.getDate()}</span>
                      {dayMeetings.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {dayMeetings.map((m) => (
                            <span
                              key={m.id}
                              className="block w-2 h-2 rounded-full bg-retail"
                              title={`${m.leadFullName} — ${m.title}`}
                            />
                          ))}
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              {selected ? selected.toLocaleDateString("en-GB", { dateStyle: "long" }) : "Select a day"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {selectedMeetings.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">No meetings on this day.</p>
            ) : (
              selectedMeetings.map((m) => (
                <div key={m.id} className="rounded-lg border border-border p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-sm">{m.title}</p>
                    <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted font-medium">
                      {m.status}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{m.leadFullName} · {m.leadBusinessName}</p>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    {new Date(m.scheduledAt).toLocaleTimeString("en-GB", { timeStyle: "short", timeZone: m.timezone })}
                    <span className="ml-1">({m.durationMinutes}m)</span>
                  </div>
                  {m.meetingLink ? (
                    <a
                      href={m.meetingLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-retail hover:underline"
                    >
                      <Video className="w-3 h-3" />
                      {m.provider || "Join"}
                    </a>
                  ) : null}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
