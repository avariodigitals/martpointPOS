import { redirect } from "next/navigation"
import { peekCreatorAuthToken } from "@/lib/creator-auth"
import { SetPasswordForm } from "./set-password-form"

export default async function CreatorSetPasswordPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const { valid, creator } = await peekCreatorAuthToken(token, "SET_PASSWORD")

  if (!valid || !creator) {
    redirect("/creator/login?error=invalid-link")
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
      <SetPasswordForm
        token={token}
        type="SET_PASSWORD"
        fullName={creator.fullName}
        email={creator.email}
      />
    </div>
  )
}
