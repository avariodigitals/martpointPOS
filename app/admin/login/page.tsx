import { LoginForm } from "./login-form"
import { readSettings } from "@/lib/settings"

export default async function AdminLoginPage() {
  const settings = await readSettings()
  const header = (settings?.header as Record<string, string>) || {}
  const logo = header.logo || "/logo.webp"

  return <LoginForm logo={logo} />
}
