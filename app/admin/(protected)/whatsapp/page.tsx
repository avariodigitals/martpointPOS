"use client"

import { WhatsAppInbox } from "@/components/admin/whatsapp-inbox"

export default function WhatsAppPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">WhatsApp Inbox</h2>
        <p className="text-muted-foreground">Reply to customer WhatsApp messages directly from the admin.</p>
      </div>
      <WhatsAppInbox />
    </div>
  )
}
