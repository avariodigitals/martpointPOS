import { requireCreatorSession } from "@/lib/creator-auth"
import { listFaqs } from "@/lib/creator-resources"
import { FaqList } from "./faq-list"
import { Card, CardContent } from "@/components/ui/card"
import { HelpCircle } from "lucide-react"

export const dynamic = "force-dynamic"

export default async function CreatorFaqPage() {
  await requireCreatorSession()
  const faqs = await listFaqs({ publishedOnly: true })

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Creator FAQ</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Answers about applications, challenges, rewards and the rules.
        </p>
      </div>

      {faqs.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <HelpCircle className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="font-medium">FAQs coming soon</p>
          </CardContent>
        </Card>
      ) : (
        <FaqList faqs={faqs} />
      )}
    </div>
  )
}
