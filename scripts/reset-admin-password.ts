/**
 * Reset the admin user's password with a new random secure password.
 * Run: npx tsx scripts/reset-admin-password.ts
 */
import { config } from "dotenv"
config({ path: ".env.local" })
import { createClient } from "@supabase/supabase-js"
import crypto from "crypto"

const supabaseUrl = process.env.SUPABASE_URL || ""
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ""

if (!supabaseUrl || !supabaseKey) {
  console.error("Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local")
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex")
  const hash = crypto.scryptSync(password, salt, 64).toString("hex")
  return `${salt}:${hash}`
}

function generateRandomPassword(length = 16): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*"
  let password = ""
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return password
}

async function resetAdminPassword() {
  const newPassword = generateRandomPassword()
  const passwordHash = hashPassword(newPassword)

  // Find the admin user by username
  const { data: users, error: findError } = await supabase
    .from("users")
    .select("id, username, name, role")
    .ilike("username", "admin")

  if (findError) {
    console.error("Error finding admin user:", findError.message)
    process.exit(1)
  }

  if (!users || users.length === 0) {
    console.error("No user with username 'admin' found in the database.")
    console.log("You may need to create one instead. Run the app once to auto-create a default admin.")
    process.exit(1)
  }

  const adminUser = users[0]

  const { error: updateError } = await supabase
    .from("users")
    .update({ password_hash: passwordHash })
    .eq("id", adminUser.id)

  if (updateError) {
    console.error("Error updating password:", updateError.message)
    process.exit(1)
  }

  console.log("\n============================================================")
  console.log("  Admin password reset successfully!")
  console.log("")
  console.log(`  Username: ${adminUser.username}`)
  console.log(`  Name:     ${adminUser.name}`)
  console.log(`  Role:     ${adminUser.role}`)
  console.log(`  Password: ${newPassword}`)
  console.log("")
  console.log("  Login at: /admin/login")
  console.log("  Change this password after logging in.")
  console.log("============================================================\n")
}

resetAdminPassword()
