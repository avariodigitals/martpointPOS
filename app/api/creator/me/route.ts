import { NextResponse } from "next/server"
import { authorizeCreator } from "@/lib/creator-auth"
import { creatorTrackingUrl } from "@/lib/creators"

export const dynamic = "force-dynamic"

export async function GET() {
  const { creator, denied } = await authorizeCreator()
  if (denied) return denied
  return NextResponse.json({
    creator: {
      id: creator.id,
      creatorId: creator.creatorId,
      referralCode: creator.referralCode,
      trackingUrl: creatorTrackingUrl(creator.referralCode),
      fullName: creator.fullName,
      email: creator.email,
      state: creator.state,
      city: creator.city,
      level: creator.levelLabel || creator.levelName || "Starter",
      status: creator.status,
    },
  })
}
