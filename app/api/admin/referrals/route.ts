import { NextResponse } from "next/server"
import { authorizeAdmin } from "@/lib/admin-auth"
import { referralAdminCan } from "@/lib/referral-permissions"
import { listReferralsForReview } from "@/lib/referral-review"

/* Internal decision queue — referral workflow rows only. */

export async function GET(request: Request) {
  const auth = await authorizeAdmin("partners", "view")
  if (auth.denied) return auth.denied
  const session = auth.session

  const url = new URL(request.url)
  const referrals = await listReferralsForReview({
    status: url.searchParams.get("status"),
    partnerId: url.searchParams.get("partnerId"),
    search: url.searchParams.get("q"),
  })
  const role = session.role
  return NextResponse.json({
    referrals,
    // The UI hides controls the server would reject anyway.
    can: {
      review: referralAdminCan(role, "referral:review"),
      attribute: referralAdminCan(role, "referral:attribute"),
    },
  })
}
