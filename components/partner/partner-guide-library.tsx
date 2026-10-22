import Link from "next/link"
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Briefcase,
  CheckCircle2,
  ClipboardCheck,
  ExternalLink,
  FileText,
  LifeBuoy,
  LockKeyhole,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react"

interface GuideCardProps {
  href: string
  title: string
  description: string
  icon: LucideIcon
  tone?: "blue" | "green" | "amber"
}

const toneClasses = {
  blue: "bg-blue-50 text-blue-700 group-hover:bg-blue-100",
  green: "bg-emerald-50 text-emerald-700 group-hover:bg-emerald-100",
  amber: "bg-amber-50 text-amber-700 group-hover:bg-amber-100",
}

function GuideCard({ href, title, description, icon: Icon, tone = "blue" }: GuideCardProps) {
  return (
    <Link
      href={href}
      className="group flex h-full items-start gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-retail/40 hover:shadow-md"
    >
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors ${toneClasses[tone]}`}>
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-3">
          <span className="font-semibold text-foreground group-hover:text-retail">{title}</span>
          <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-retail" />
        </span>
        <span className="mt-2 block text-sm leading-6 text-muted-foreground">{description}</span>
      </span>
    </Link>
  )
}

function GuideBackLink() {
  return (
    <Link href="/partner/guide" className="inline-flex items-center gap-2 text-sm font-medium text-retail hover:underline">
      <ArrowLeft className="h-4 w-4" /> Back to Guide Library
    </Link>
  )
}

export function PartnerGuideIndex() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="rounded-3xl bg-gradient-to-br from-retail to-retail/75 p-7 text-white shadow-lg">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/75">MartPoint Partner Library</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Choose a guide</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-white/85">
          Open only the guide you need. Use the Portal Guide to learn the partner account, the Client Setup Guide to support an assigned customer, and the Use Case Library to prepare industry-specific conversations.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-2">
        <GuideCard
          href="/partner/guide/portal"
          title="Partner Portal Guide"
          description="Login, leads, quotes, customer assignments, work orders, invoices, commissions, documents, and support."
          icon={BookOpen}
          tone="blue"
        />
        <GuideCard
          href="/partner/guide/client-setup"
          title="Client Setup & Handover Guide"
          description="Prepare, train, practise, and hand over an assigned client after MartPoint completes the technical setup."
          icon={Users}
          tone="green"
        />
        <GuideCard
          href="/industries"
          title="Use Case Library"
          description="Browse the industry pages and choose the closest business workflow to guide the client appropriately."
          icon={Briefcase}
          tone="amber"
        />
        <GuideCard
          href="/partner/resources"
          title="Shared Resources"
          description="Download partner-only materials, documents, training files, and resources made available to your organisation."
          icon={FileText}
          tone="blue"
        />
      </section>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-retail" />
          <div>
            <h2 className="font-semibold text-foreground">Keep the boundary clear</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Partners guide the client through permitted screens, business data, workflows, and training. MartPoint retains responsibility for platform setup, licensing, security, billing, deployment, and technical changes.
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}

function ChecklistItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2 text-sm leading-6 text-muted-foreground">
      <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-emerald-600" />
      <span>{children}</span>
    </li>
  )
}

function SessionStep({ number, title, children }: { number: string; title: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 border-b border-border py-4 last:border-b-0">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-retail-soft text-xs font-bold text-retail">{number}</span>
      <div>
        <h3 className="font-semibold text-foreground">{title}</h3>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">{children}</p>
      </div>
    </div>
  )
}

const useCases = [
  ["Fashion and boutiques", "/industries/fashion-stores"],
  ["Gadget stores", "/industries/gadget-stores"],
  ["Frozen foods", "/industries/frozen-foods"],
  ["Printing shops", "/industries/printing"],
  ["Physiotherapy", "/industries/physiotherapy"],
  ["Automobile", "/industries/automobile"],
  ["Processing plants", "/industries/processing-plant"],
  ["Nylon and polythene", "/industries/nylon-polythene-manufacturing"],
] as const

export function PartnerClientSetupGuide() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <GuideBackLink />

      <header className="rounded-3xl bg-gradient-to-br from-emerald-700 to-emerald-600 p-7 text-white shadow-lg">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/75">Client Setup &amp; Handover</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Help the client start with confidence</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-white/85">
          Use your Partner Portal access to guide the assigned client through their first working day, train the right people, and hand over a confident operating team.
        </p>
      </header>

      <section className="rounded-2xl border border-blue-200 bg-blue-50 p-5 text-blue-950">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-blue-700" />
          <div>
            <h2 className="font-semibold">Your role after MartPoint completes setup</h2>
            <p className="mt-1 text-sm leading-6">
              You help the client understand and use the workspace. MartPoint keeps responsibility for platform setup, licensing, security, billing, deployment, and technical changes.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <ClipboardCheck className="mt-0.5 h-5 w-5 shrink-0 text-retail" />
          <div>
            <h2 className="font-semibold text-foreground">Before the client session</h2>
            <ul className="mt-3 space-y-2">
              <ChecklistItem>Open <strong>Customers</strong> in the Partner Portal and confirm the assigned client, contact person, access level, business status, and deployment status.</ChecklistItem>
              <ChecklistItem>If available to your role, open the client&apos;s <strong>Onboarding Workspace</strong> and review the assigned tasks.</ChecklistItem>
              <ChecklistItem>Review the approved scope and any assigned <strong>Work Order</strong>. Do not promise work outside that scope.</ChecklistItem>
              <ChecklistItem>Ask the client to prepare store details, locations, staff roles, catalogue data, prices, opening stock, payment methods, and a real example workflow.</ChecklistItem>
            </ul>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-950">
        <div className="flex items-start gap-3">
          <LockKeyhole className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
          <div>
            <h2 className="font-semibold">Keep technical secrets out of the session</h2>
            <p className="mt-1 text-sm leading-6">
              Never ask the client to send server, database, source-code, API, payment-provider, email, encryption, or hosting credentials. Do not request or store passwords in WhatsApp, email, notes, or spreadsheets. Send technical or security actions to MartPoint through the approved support route.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <Users className="mt-0.5 h-5 w-5 shrink-0 text-retail" />
          <div className="w-full">
            <h2 className="font-semibold text-foreground">Walk through one real business day</h2>
            <div className="mt-2">
              <SessionStep number="1" title="Begin with the owner or manager">Confirm the business goal, who approves changes, and who will own day-to-day use.</SessionStep>
              <SessionStep number="2" title="Let the client sign in">Use the client&apos;s own account for client work. The client should choose and keep their own password; never collect it.</SessionStep>
              <SessionStep number="3" title="Check the business foundation">Review the store profile, locations, operating details, staff, and roles.</SessionStep>
              <SessionStep number="4" title="Confirm the catalogue">Check product or service names, categories, units, selling prices, variants, images, and opening quantities with the client.</SessionStep>
              <SessionStep number="5" title="Run the client&apos;s normal workflow">Practise the important path: receive stock or materials, serve the customer, record the sale or service, take payment, issue the receipt, and check the result.</SessionStep>
              <SessionStep number="6" title="Finish with follow-up">Show where the client checks sales, stock, cash, and reports. Record questions, agree a follow-up date, and explain support.</SessionStep>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <Briefcase className="mt-0.5 h-5 w-5 shrink-0 text-retail" />
          <div className="w-full">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold text-foreground">Use the client&apos;s Use Case</h2>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">Choose the closest industry workflow and use it as the agenda for training and follow-up.</p>
              </div>
              <Link href="/industries" className="inline-flex items-center gap-2 text-sm font-medium text-retail hover:underline">
                Browse all Use Cases <ExternalLink className="h-4 w-4" />
              </Link>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {useCases.map(([label, href]) => (
                <Link key={href} href={href} className="rounded-xl border border-border bg-background p-3 text-sm font-medium text-foreground transition-colors hover:border-retail/40 hover:bg-retail-soft/30">
                  {label}
                </Link>
              ))}
            </div>
            <div className="mt-4 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-950">
              <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
              <p>
                <strong>Training aid:</strong> You may use the client-facing guide available in the client&apos;s MartPoint fleet installation to train the client. Share the relevant Use Case and User Manual; keep this Partner Portal guide, internal notes, and partner-only documents private.
              </p>
            </div>
            <p className="mt-4 text-xs leading-5 text-muted-foreground">If no Use Case is an exact match, use the closest workflow and ask MartPoint before describing a new workflow as supported. Do not invent workarounds that could affect stock, payments, reporting, or customer records.</p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h2 className="font-semibold text-foreground">Handover checklist</h2>
          <ul className="mt-3 space-y-2">
            <ChecklistItem>The client owner or manager can sign in and navigate the main screens.</ChecklistItem>
            <ChecklistItem>Each staff member uses the right role and their own access.</ChecklistItem>
            <ChecklistItem>Profile, locations, catalogue, prices, and opening quantities are understood.</ChecklistItem>
            <ChecklistItem>The client completes one full real-world workflow without your hands on the keyboard.</ChecklistItem>
            <ChecklistItem>The Use Case and User Manual have been shared.</ChecklistItem>
            <ChecklistItem>Open questions, out-of-scope requests, and a follow-up date are recorded.</ChecklistItem>
          </ul>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h2 className="font-semibold text-foreground">Who handles what?</h2>
          <div className="mt-3 space-y-3 text-sm leading-6 text-muted-foreground">
            <p><strong className="text-foreground">Partner:</strong> guide permitted screens, business data, workflow practice, staff training, and first-line use support when assigned.</p>
            <p><strong className="text-foreground">MartPoint:</strong> handle platform setup, deployment, licensing, subscription, security, billing, technical changes, payment confirmation, data recovery, and final onboarding review.</p>
            <p className="flex items-start gap-2 rounded-xl border border-blue-200 bg-blue-50 p-3 text-blue-950"><LifeBuoy className="mt-0.5 h-4 w-4 shrink-0" /> Escalate access problems, errors, billing, security, data loss, licence changes, and anything outside your approved scope through Partner Portal Support.</p>
          </div>
        </div>
      </section>
    </div>
  )
}
