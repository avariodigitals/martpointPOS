import { NextResponse } from "next/server"
import { getSession } from "@/lib/admin-auth"
import { supabase } from "@/lib/supabase"

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data, error } = await supabase
    .from("user_preferences")
    .select("preferences")
    .eq("user_id", session.userId)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ preferences: data?.preferences || {} })
}

export async function PATCH(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const body = await request.json()
    const { preferences } = body

    const { data, error } = await supabase
      .from("user_preferences")
      .upsert({ 
        user_id: session.userId, 
        preferences: preferences, 
        updated_at: new Date().toISOString() 
      }, { onConflict: 'user_id' })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ success: true, preferences: data.preferences })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
