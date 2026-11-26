import fs from "node:fs"
import path from "node:path"
import { renderPartnerGradingPolicyPdf } from "../lib/partner-grading-policy-pdf.mjs"

const output = path.resolve("output/partner-agreement-review/MartPoint-Partner-Performance-Grading-Progression-Policy-DRAFT.pdf")
fs.mkdirSync(path.dirname(output), { recursive: true })
const bytes = renderPartnerGradingPolicyPdf({
  version: "2.0",
  status: "DRAFT",
  silver_outcomes: 1,
  gold_outcomes: 10,
  platinum_outcomes: 25,
  silver_min_days: 90,
  gold_min_days: 183,
  platinum_min_days: 365,
  criteria: {
    partnerTypes: ["REFERRAL", "CHANNEL", "IMPLEMENTATION", "TECHNOLOGY", "PAYMENT"],
    requirements: ["completed onboarding", "applicable certification", "satisfactory customer outcomes", "satisfactory compliance", "management approval", "performance review"],
  },
})
fs.writeFileSync(output, Buffer.from(bytes))
console.log(output)
