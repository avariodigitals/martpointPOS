import { NextResponse } from "next/server"
import { authorizeAdmin } from "@/lib/admin-auth"
import { getFinanceOverview, type FinanceOverview } from "@/lib/finance-commercial"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"

/* ─── GET ─── */
export async function GET(request: Request) {
  const { denied } = await authorizeAdmin("finance", "view")
  if (denied) return denied

  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get("action") || "overview"

    if (action === "overview") {
      const overview = await getFinanceOverview()
      return NextResponse.json({ success: true, overview })
    }

    if (action === "products") {
      if (!isSupabaseConfigured()) {
        return NextResponse.json({ success: true, products: [], plans: [], addons: [] })
      }
      const [products, plans, addons] = await Promise.all([
        supabase.from("commercial_products").select("*").order("name"),
        supabase.from("plans").select("*").order("name"),
        supabase.from("addons").select("*").order("name"),
      ])
      return NextResponse.json({
        success: true,
        products: products.data || [],
        plans: plans.data || [],
        addons: addons.data || [],
        productsError: products.error,
        plansError: plans.error,
        addonsError: addons.error,
      })
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 })
  } catch (err) {
    console.error("[Finance Commercial API]", err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
