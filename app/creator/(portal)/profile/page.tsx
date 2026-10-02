import { requireCreatorSession } from "@/lib/creator-auth"
import { getApplicationSocialProfiles, creatorTrackingUrl } from "@/lib/creators"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ProfileForm } from "./profile-form"
import { SocialsManager } from "./socials-form"

export default async function CreatorProfilePage() {
  const { creator } = await requireCreatorSession()
  const socials = await getApplicationSocialProfiles(creator.applicationId)

  return (
    <div className="space-y-6 max-w-3xl">
      <h2 className="text-2xl font-bold tracking-tight">Profile</h2>

      <Card>
        <CardHeader><CardTitle className="text-sm font-medium">Account</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Creator ID</span><span className="font-mono">{creator.creatorId}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Referral code</span><span className="font-mono">{creator.referralCode}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Level</span><span>{creator.levelLabel || "Starter"}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Email</span><span>{creator.email}</span></div>
          <div className="flex justify-between gap-4"><span className="text-muted-foreground">Tracking URL</span><span className="font-mono text-xs break-all text-right">{creatorTrackingUrl(creator.referralCode)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Member since</span><span>{new Date(creator.activatedAt || creator.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</span></div>
        </CardContent>
      </Card>

      <ProfileForm
        initial={{
          phone: creator.phone || "",
          whatsapp: creator.whatsapp || "",
          state: creator.state || "",
          city: creator.city || "",
          bio: creator.bio || "",
        }}
      />

      <SocialsManager
        initial={socials.map((s) => ({
          id: s.id,
          platform: s.platform,
          profileUrl: s.profileUrl,
          username: s.username,
          followers: s.followers,
          isPrimary: s.isPrimary,
        }))}
      />
    </div>
  )
}
