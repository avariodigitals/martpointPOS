import { NextRequest, NextResponse } from "next/server"
import fs from "fs"
import path from "path"

const faqsPath = path.join(process.cwd(), "data", "faqs.json")

function readFaqs() {
  try {
    if (!fs.existsSync(faqsPath)) return []
    const data = fs.readFileSync(faqsPath, "utf-8")
    return JSON.parse(data)
  } catch {
    return []
  }
}

function writeFaqs(faqs: unknown[]) {
  try {
    fs.writeFileSync(faqsPath, JSON.stringify(faqs, null, 2), "utf-8")
    return true
  } catch {
    return false
  }
}

// GET — return all FAQs
export async function GET() {
  const faqs = readFaqs()
  return NextResponse.json({ faqs })
}

// POST — save all FAQs (replace entire array)
export async function POST(request: NextRequest) {
  try {
    const { faqs } = await request.json()

    if (!Array.isArray(faqs)) {
      return NextResponse.json({ error: "Invalid data: faqs must be an array" }, { status: 400 })
    }

    // Validate each FAQ has required fields
    for (const faq of faqs) {
      if (!faq.id || !faq.question || !faq.answer) {
        return NextResponse.json(
          { error: "Each FAQ must have id, question, and answer" },
          { status: 400 }
        )
      }
    }

    const success = writeFaqs(faqs)
    if (!success) {
      return NextResponse.json({ error: "Failed to save FAQs" }, { status: 500 })
    }

    return NextResponse.json({ success: true, faqs })
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }
}
