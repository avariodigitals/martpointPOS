import { creatorCallHistory } from "@/lib/creator-call-history"
type Context = { params: Promise<{ id: string }> }
export async function GET(request: Request, { params }: Context) {
  return creatorCallHistory(request, (await params).id, "creator")
}
export async function POST(request: Request, { params }: Context) {
  return creatorCallHistory(request, (await params).id, "creator")
}
