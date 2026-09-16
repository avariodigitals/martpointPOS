"use client"

import { useEffect, useRef, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, MessageCircle, Send } from "lucide-react"

interface WhatsAppMessage {
  id: string
  wa_message_id: string | null
  wa_id: string
  from_number: string
  to_number: string
  body: string
  direction: "inbound" | "outbound"
  status: string | null
  created_at: string
}

interface Conversation {
  wa_id: string
  phone: string
  lastMessage: string
  lastAt: string
  messages: WhatsAppMessage[]
}

export function WhatsAppInbox() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const load = async () => {
    try {
      const res = await fetch("/api/admin/whatsapp/conversations")
      const data = await res.json()
      const list: Conversation[] = data.conversations || []
      setConversations(list)
      if (list.length > 0 && !selected) {
        setSelected(list[0].wa_id)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    const interval = setInterval(load, 5000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [selected, conversations])

  const selectedConv = conversations.find((c) => c.wa_id === selected)

  const send = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selected || !input.trim() || sending) return

    setSending(true)
    try {
      const res = await fetch("/api/admin/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: selected, message: input.trim() }),
      })
      if (res.ok) {
        setInput("")
        await load()
      } else {
        console.error("Failed to send")
      }
    } catch (err) {
      console.error(err)
    } finally {
      setSending(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading WhatsApp inbox…
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="h-[600px] flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <MessageCircle className="w-4 h-4" />
          WhatsApp Inbox
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 p-0">
        {conversations.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">
            No WhatsApp messages yet. Configure 360dialog and set the webhook to start receiving chats.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 h-full border-t">
            <div className="border-r overflow-y-auto">
              {conversations.map((conv) => (
                <button
                  key={conv.wa_id}
                  onClick={() => setSelected(conv.wa_id)}
                  className={`w-full text-left p-3 border-b transition-colors ${
                    selected === conv.wa_id ? "bg-muted" : "hover:bg-muted/50"
                  }`}
                >
                  <p className="text-sm font-medium">{conv.phone}</p>
                  <p className="text-xs text-muted-foreground truncate">{conv.lastMessage}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">{new Date(conv.lastAt).toLocaleTimeString()}</p>
                </button>
              ))}
            </div>

            <div className="md:col-span-2 flex flex-col h-full">
              {selectedConv ? (
                <>
                  <div className="p-3 border-b text-sm font-medium bg-muted/20">{selectedConv.phone}</div>
                  <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
                    {selectedConv.messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex ${msg.direction === "outbound" ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                            msg.direction === "outbound"
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted"
                          }`}
                        >
                          {msg.body}
                          <p className="text-[10px] opacity-70 mt-1 text-right">
                            {new Date(msg.created_at).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <form onSubmit={send} className="p-3 border-t flex gap-2">
                    <input
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder="Type a reply…"
                      className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                    <Button type="submit" size="sm" disabled={!input.trim() || sending}>
                      {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </Button>
                  </form>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
                  Select a conversation
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
