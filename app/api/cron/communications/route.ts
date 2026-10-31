import { NextResponse } from "next/server"
import { runCommunicationsSweep } from "@/lib/communications"
export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60
export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET
  if (!expected || request.headers.get("authorization") !== `Bearer ${expected}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  try { return NextResponse.json(await runCommunicationsSweep()) }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Sweep failed" }, { status: 500 }) }
}
