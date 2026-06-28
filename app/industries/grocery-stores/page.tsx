import type { Metadata } from "next"
import { IndustryTemplate } from "@/app/industries/_components/industry-template"
import { groceryStores } from "@/lib/industries"

export const metadata: Metadata = {
  title: groceryStores.seo.title,
  description: groceryStores.seo.description,
}

export default function GroceryStoresPage() {
  return <IndustryTemplate data={groceryStores} />
}
