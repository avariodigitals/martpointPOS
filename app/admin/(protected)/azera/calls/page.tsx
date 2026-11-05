import { AfricaBrowserPhone } from "@/components/admin/africa-browser-phone";
import { getSession } from "@/lib/admin-auth";
import { PhoneCall } from "lucide-react";

export default async function ContactCentrePage() {
  const session = await getSession();
  const userName = session?.name || session?.username || "Team member";

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 pb-6">
      <header className="flex flex-wrap items-center gap-4 rounded-2xl border border-indigo-100 bg-white px-5 py-4 shadow-sm sm:px-6">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#3037b1] to-[#737cf4] text-white shadow-md shadow-indigo-900/15"><PhoneCall className="h-5 w-5" /></span>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.16em] text-indigo-700">MartPoint · Contact Centre</p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight text-slate-950 sm:text-2xl">Your phone workspace</h1>
          <p className="mt-1 text-sm text-slate-600">Manage availability, calls, and customer conversations.</p>
        </div>
      </header>
      <AfricaBrowserPhone userName={userName} dedicated />
    </div>
  );
}
