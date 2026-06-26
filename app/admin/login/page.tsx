import { LoginForm } from "./login-form"
import fs from "fs"
import path from "path"

function readSettings() {
  try {
    const settingsPath = path.join(process.cwd(), "data", "settings.json")
    if (!fs.existsSync(settingsPath)) return null
    const data = fs.readFileSync(settingsPath, "utf-8")
    return JSON.parse(data)
  } catch {
    return null
  }
}

export default function AdminLoginPage() {
  const settings = readSettings()
  const logo = settings?.header?.logo || "/logo.webp"

  return <LoginForm logo={logo} />
}
