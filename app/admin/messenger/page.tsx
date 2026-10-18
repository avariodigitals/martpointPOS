"use client"

import { useEffect, useState } from "react"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, MessageCircle, Send } from "lucide-react"

interface MessengerMessage {
  id: string
  author_type: "customer" | "agent" | "system"
  message: string
  direction: "inbound" | "outbound"
  created_at: string
}

export default function MessengerPage() {
  const [conversations, setConversations] = useState<any[]>([])
  const [selected, setSelected] = useState<any>(null)
  const [messages, setMessages] = useState<MessengerMessage[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadConversations()
  }, [])

  async function loadConversations() {
    try {
      const res = await fetch("/api/azera/conversations?channel=messenger")
      const json = await res.json()
      if (json.conversations) {
        setConversations(json.conversations)
        if (!selected && json.conversations.length > 0) {
          setSelected(json.conversations[0])
        }
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  async function loadMessages(convId: string) {
    try {
      const res = await fetch(`/api/azera/conversations/${encodeURIComponent(convId)}/messages?limit=100`)
      const json = await res.json()
      if (json.messages) {
        setMessages(json.messages)
      }
    } catch {
      setMessages([])
    }
  }

  function selectConversation(conv: any) {
    setSelected(conv)
    setMessages([])
    loadMessages(conv.id)
  }

  async function sendReply() {
    if (!input.trim() || !selected?.id) return
    const text = input.trim()
    setInput("")

    try {
      await fetch(`/api/azera/conversations/${encodeURIComponent(selected.id)}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, author_type: "agent", direction: "outbound" }),
      })
      loadMessages(selected.id)
    } catch {
      // ignore
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <MessageCircle className="w-5 h-5" />
          Messenger Inbox
        </h1>
        <p className="text-muted-foreground">
          Facebook Messenger conversations. Set up your Page ID in
          <span className="font-medium">Admin → Settings → Integrations → Messenger</span>.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4 space-y-2">
            {conversations.length === 0 ? (
              <div className="flex items-center justify-center py-10 text-muted-foreground text-sm">
                No Messenger conversations yet.
              </div>
            ) : (
              <div className="space-y-1">
                {conversations.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => selectConversation(c)}
                    className={cn(
                      "w-full flex items-center gap-3 p-3 rounded-lg border transition-colors text-left",
                      selected?.id === c.id
                        ? "bg-retail/10 border-retail/50"
                        : "bg-background border-border hover:bg-muted"
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-xs font-medium truncate">
                          {c.customer_name || c.external_id}
                        </span>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded ${c.status === "open" ? "bg-blue-50 text-blue-700" : "bg-gray-100 text-gray-500"}`}
                        >
                          {c.status}
                        </span>
                      </div>
                      {c.last_message && (
                        <div className="text-xs text-muted-foreground truncate">
                          {c.last_message.message}
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="lg:col-span-8 flex flex-col h-[70vh]">
            {!selected ? (
              <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
                <MessageCircle className="w-12 h-12 opacity-20 mb-3" />
                <p>Select a conversation to reply.</p>
              </div>
            ) : (
              <div className="flex flex-col h-full">
                <Card className="flex-1 flex flex-col">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-medium">
                        Messenger
                      </span>
                      <div className="flex items-baseline gap-1">
                        <h3 className="font-semibold text-sm">
                          {selected.customer_name || selected.external_id}
                        </h3>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="flex-1 overflow-y-auto p-0">
                    <div className="p-4 space-y-3">
                      {messages.length === 0 && (
                        <div className="text-center py-10 text-muted-foreground text-sm">
                          No messages yet
                        </div>
                      )}
                      {messages.map((m) => (
                        <div
                          key={m.id}
                          className={cn(
                            "max-w-[85%] rounded-lg p-3 text-sm break-words",
                            m.direction === "outbound"
                              ? "ml-auto bg-retail text-white rounded-tr-none"
                              : "mr-auto bg-muted text-foreground rounded-tl-none"
                          )}
                        >
                          <div className="flex items-center gap-1.5 mb-1">
                            <span
                              className="text-[10px] font-medium uppercase tracking-wider"
                            >
                              {m.author_type === "agent" ? "Agent" : "Customer"}
                            </span>
                          </div>
                          {m.message}
                        </div>
                      ))}
                    </div>
                  </CardContent>

                  <div className="border-t border-border p-3 bg-white/50 flex gap-2">
                    <input
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder="Type a reply…"
                      className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-retail/50"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault()
                          sendReply()
                        }
                      }}
                    />
                    <button
                      onClick={sendReply}
                      disabled={!input.trim()}
                      className="rounded-lg px-4 py-2 text-sm font-medium transition-opacity disabled:opacity-50 bg-retail text-white disabled:bg-retail/40"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </Card>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function cn(...classes: (string | undefined | null | boolean)[]): string {
  return classes.filter(Boolean).join(" ")
}
