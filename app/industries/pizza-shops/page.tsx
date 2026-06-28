import type { Metadata } from "next"
import { IndustryTemplate } from "@/app/industries/_components/industry-template"
import { pizzaShops } from "@/lib/industries"

export const metadata: Metadata = {
  title: pizzaShops.seo.title,
  description: pizzaShops.seo.description,
}

export default function PizzaShopsPage() {
  return <IndustryTemplate data={pizzaShops} />
}
