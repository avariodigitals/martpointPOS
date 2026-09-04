import { getPartnerInvitationByToken } from "@/lib/partner-service"
import { AcceptInvitationForm } from "./accept-form"

export default async function PartnerInvitePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const invitation = await getPartnerInvitationByToken(token)

  if (!invitation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
        <div className="max-w-sm w-full rounded-xl border border-border bg-background p-6 text-center">
          <h1 className="text-xl font-bold mb-2">Invitation Expired</h1>
          <p className="text-sm text-muted-foreground">This invitation link is invalid, expired or has already been used.</p>
        </div>
      </div>
    )
  }

  const partner = (invitation.partners as Record<string, unknown>) || {}
  const user = (invitation.partner_users as Record<string, unknown>) || {}

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
      <AcceptInvitationForm
        token={token}
        partnerName={(partner.business_name as string) || ""}
        fullName={(user.full_name as string) || ""}
        email={(user.email as string) || ""}
      />
    </div>
  )
}
