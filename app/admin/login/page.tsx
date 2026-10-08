import { LoginForm } from "./login-form"
import { readSettings } from "@/lib/settings"

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ expired?: string }>
}) {
  const settings = await readSettings()
  const header = (settings?.header as Record<string, string>) || {}
  const logo = header.logo || "/logo.webp"

  const params = await searchParams
  const sessionExpired = params?.expired === "1"

  return <LoginForm logo={logo} sessionExpired={sessionExpired} />
}
