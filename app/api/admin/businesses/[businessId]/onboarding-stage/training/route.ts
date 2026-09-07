import { NextResponse } from "next/server"
import { authorizeAdmin } from "@/lib/admin-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { z } from "zod"

const schema = z.object({
  sessionNumber: z.number().optional().default(1),
  trainingDate: z.string().datetime().nullable().optional(),
  mode: z.enum(["Remote", "Onsite"]).optional(),
  trainer: z.string().optional(),
  attendees: z.string().optional(),
  notes: z.string().optional(),
  modulesCompleted: z.array(z.string()).optional(),
  completed: z.boolean().optional().default(false),
})

export async function POST(request: Request, { params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params
  const auth = await authorizeAdmin("businesses", "manage")
  if (auth.denied) return auth.denied

  try {
    const body = await request.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })

    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: "Database not configured" }, { status: 500 })
    }

    const { data, error } = await supabase
      .from("onboarding_training_sessions")
      .insert({
        business_id: businessId,
        session_number: parsed.data.sessionNumber,
        training_date: parsed.data.trainingDate,
        mode: parsed.data.mode,
        trainer: parsed.data.trainer,
        attendees: parsed.data.attendees,
        notes: parsed.data.notes,
        modules_completed: parsed.data.modulesCompleted || [],
        completed: parsed.data.completed,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error || !data) {
      console.error("[training] insert error", error)
      return NextResponse.json({ error: "Failed to save training session" }, { status: 500 })
    }

    return NextResponse.json({ success: true, session: data })
  } catch {
    return NextResponse.json({ error: "Failed to save training session" }, { status: 500 })
  }
}
