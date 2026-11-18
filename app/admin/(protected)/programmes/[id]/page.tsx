import { BusinessGrowthProgrammeDetail } from "@/components/admin/business-growth-programme-detail"

export const dynamic = "force-dynamic"

export default async function ProgrammeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <BusinessGrowthProgrammeDetail id={id} />
}
