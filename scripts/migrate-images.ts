/**
 * Migrate local images from public/uploads to Supabase Storage
 * Run: npx tsx scripts/migrate-images.ts
 */
import { createClient } from "@supabase/supabase-js"
import fs from "fs"
import path from "path"

const supabaseUrl = process.env.SUPABASE_URL || ""
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ""

if (!supabaseUrl || !supabaseKey) {
  console.error("Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.")
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const BUCKET = "uploads"
const UPLOADS_DIR = path.join(process.cwd(), "public", "uploads")

async function uploadFile(localPath: string, relativePath: string) {
  const buffer = fs.readFileSync(localPath)
  const { error } = await supabase.storage.from(BUCKET).upload(relativePath.replace(/\\/g, "/"), buffer, {
    contentType: getContentType(localPath),
    upsert: true,
  })
  if (error) {
    console.error(`  ❌ Failed: ${relativePath} — ${error.message}`)
    return false
  }
  console.log(`  ✅ Uploaded: ${relativePath}`)
  return true
}

function getContentType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase()
  const map: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".gif": "image/gif",
  }
  return map[ext] || "application/octet-stream"
}

async function migrate() {
  if (!fs.existsSync(UPLOADS_DIR)) {
    console.log("No local uploads directory found.")
    return
  }

  console.log("📤 Migrating images to Supabase Storage...\n")
  let success = 0
  let failed = 0

  async function walk(dir: string, prefix = "") {
    const items = fs.readdirSync(dir)
    for (const item of items) {
      const fullPath = path.join(dir, item)
      const relPath = prefix ? `${prefix}/${item}` : item
      if (fs.statSync(fullPath).isDirectory()) {
        await walk(fullPath, relPath)
      } else {
        const ok = await uploadFile(fullPath, relPath)
        if (ok) success++
        else failed++
      }
    }
  }

  await walk(UPLOADS_DIR)
  console.log(`\n🎉 Done! ${success} uploaded, ${failed} failed.`)
  console.log("\nYour images are now in Supabase Storage bucket: 'uploads'")
  console.log("Update your settings to use the new public URLs if needed.")
}

migrate().catch((err) => {
  console.error("Migration failed:", err)
  process.exit(1)
})
