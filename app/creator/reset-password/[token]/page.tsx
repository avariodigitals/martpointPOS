import { redirect } from "next/navigation"
import { peekCreatorAuthToken } from "@/lib/creator-auth"
import { SetPasswordForm } from "../../set-password/[token]/set-password-form"

export default async function CreatorResetPasswordPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const { valid, creator } = await peekCreatorAuthToken(token, "RESET_PASSWORD")

  if (!valid || !creator) {
    redirect("/creator/login?error=invalid-link")
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
      <SetPasswordForm
        token={token}
        type="RESET_PASSWORD"
        fullName={creator.fullName}
        email={creator.email}
      />
    </div>
  )
}
