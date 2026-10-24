import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { isSupabaseConfigured, supabase } from "@/lib/supabase"
import { awardExpectation } from "@/lib/creator-challenges"
import {
  ArrowRight,
  Award,
  Check,
  ChevronLeft,
  Clock3,
  FileCheck2,
  Info,
  LockKeyhole,
  Megaphone,
  Scale,
  Sparkles,
  Target,
  Trophy,
  Users,
} from "lucide-react"

export const revalidate = 300

type Challenge = {
  id: string
  name: string
  slug: string
  description: string | null
  objective: string | null
  theme: string | null
  status: string
  start_date: string | null
  join_opens_at: string | null
  join_closes_at: string | null
  submission_deadline: string | null
  performance_cutoff: string | null
  announcement_date: string | null
  eligible_platforms: string[] | null
  required_hashtags: string[] | null
  required_mentions: string[] | null
  required_cta: string | null
  content_requirements: string | null
  prohibited_claims: string | null
  judging_criteria: string | null
  min_submissions: number
  max_submissions: number | null
  creator_ready_required: boolean
}

type AwardRow = {
  id: string
  award_type: "OVERALL" | "CONVERSION" | "REACH" | "CREATIVE" | "RISING" | "REGIONAL" | "CUSTOM"
  title: string
  description: string | null
  winners_count: number
  cash_amount_kobo: number | null
  non_cash_reward: string | null
  judging_criteria: string | null
  scoring_config: Record<string, unknown>
}

type Brief = {
  overview?: string
  audience?: string
  keyMessage?: string
  directions?: string[]
  requiredElements?: string[]
  exampleIdeas?: string[]
  submissionInstructions?: string
  judgingExplainer?: string
}

async function getChallenge(slug: string): Promise<{ challenge: Challenge; awards: AwardRow[]; brief: Brief }> {
  if (!isSupabaseConfigured()) notFound()

  const { data: challenge } = await supabase
    .from("creator_challenges")
    .select("id, name, slug, description, objective, theme, status, start_date, join_opens_at, join_closes_at, submission_deadline, performance_cutoff, announcement_date, eligible_platforms, required_hashtags, required_mentions, required_cta, content_requirements, prohibited_claims, judging_criteria, min_submissions, max_submissions, creator_ready_required")
    .eq("slug", slug)
    .in("status", ["ACTIVE", "SCHEDULED"])
    .maybeSingle()

  if (!challenge) notFound()

  const [{ data: awards }, { data: briefRow }] = await Promise.all([
    supabase
      .from("creator_challenge_awards")
      .select("id, award_type, title, description, winners_count, cash_amount_kobo, non_cash_reward, judging_criteria, scoring_config")
      .eq("challenge_id", challenge.id)
      .order("sort_order", { ascending: true }),
    supabase
      .from("creator_challenge_briefs")
      .select("sections")
      .eq("challenge_id", challenge.id)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  return {
    challenge: challenge as Challenge,
    awards: (awards || []) as AwardRow[],
    brief: ((briefRow?.sections || {}) as Brief),
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const data = await getChallenge(slug)
  return {
    title: `${data.challenge.name} — Creator Network`,
    description: data.challenge.description || "View the MartPoint Creator Challenge brief, prizes, eligibility and timeline.",
    alternates: { canonical: `/creators/challenges/${data.challenge.slug}` },
  }
}

function date(value: string | null): string {
  if (!value) return "To be confirmed"
  return new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
}

function money(kobo: number | null): string {
  if (!kobo) return "Recognition / non-cash reward"
  return `₦${(kobo / 100).toLocaleString("en-NG")}`
}

function statusLabel(status: string): string {
  return status === "ACTIVE" ? "Live now" : "Coming soon · Pilot 001"
}

function List({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-retail" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}

export default async function PublicChallengePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const { challenge: c, awards, brief } = await getChallenge(slug)
  const prizePool = awards.reduce((sum, award) => sum + (award.cash_amount_kobo || 0), 0)
  const platforms = (c.eligible_platforms || []).map((p) => {
    const label = p.replaceAll("_", " ").toLowerCase()
    return label === "tiktok" ? "TikTok" : label.replace(/\b\w/g, (letter) => letter.toUpperCase())
  })
  const hashtags = c.required_hashtags || []
  const mentions = c.required_mentions || []
  const directions = brief.directions || []
  const requiredElements = brief.requiredElements || []
  const exampleIdeas = brief.exampleIdeas || []

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main>
        <section className="relative overflow-hidden bg-[#0A0F1C] text-white">
          <div className="absolute inset-0 bg-gradient-to-br from-retail/25 via-transparent to-transparent" />
          <div className="relative mx-auto max-w-7xl px-4 py-14 sm:px-6 md:py-20 lg:px-8">
            <Link href="/creators" className="mb-8 inline-flex items-center gap-1 text-sm text-gray-300 hover:text-white">
              <ChevronLeft className="h-4 w-4" /> Creator Network
            </Link>
            <div className="max-w-4xl">
              <div className="mb-5 flex flex-wrap items-center gap-3 text-sm font-semibold uppercase tracking-[0.16em]">
                <span className="inline-flex items-center gap-2 text-retail-light"><Megaphone className="h-4 w-4" /> Featured Challenge</span>
                <span className="rounded-full bg-blue-400/15 px-3 py-1 text-xs tracking-normal text-blue-100">{statusLabel(c.status)}</span>
              </div>
              <p className="mb-3 text-sm font-medium text-retail-light">{c.name}</p>
              <h1 className="text-4xl font-bold tracking-tight md:text-6xl">{c.theme || c.name}</h1>
              <p className="mt-6 max-w-3xl text-lg leading-relaxed text-gray-300">{c.description}</p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg"><Link href="/creators/apply">Apply to Creator Network <ArrowRight className="h-4 w-4" /></Link></Button>
                <Button asChild size="lg" variant="outline" className="border-white/30 bg-transparent text-white hover:bg-white/10"><Link href="/creators/application-status">Already applied? Check status</Link></Button>
              </div>
            </div>
          </div>
        </section>

        <section className="border-b bg-muted/30">
          <div className="mx-auto grid max-w-7xl grid-cols-2 gap-4 px-4 py-6 sm:grid-cols-4 sm:px-6 lg:px-8">
            <Stat icon={Trophy} value={`₦${(prizePool / 100).toLocaleString("en-NG")}`} label="Total cash prize pool" />
            <Stat icon={Award} value={`${awards.length}`} label="Award categories" />
            <Stat icon={Users} value="20–30" label="Founding cohort" />
            <Stat icon={Target} value={platforms.join(" · ") || "Eligible platforms"} label="Where you can publish" />
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 md:py-12 lg:px-8">
          <div className="flex items-start gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-5 text-blue-950">
            <Info className="mt-0.5 h-5 w-5 shrink-0 text-blue-700" />
            <div>
              <p className="font-semibold">What “Pilot 001” means</p>
              <p className="mt-1 text-sm leading-relaxed text-blue-900">
                This is MartPoint&apos;s first limited founding cohort — not an unfinished or private test. The challenge is currently scheduled and will be activated once the cohort is ready. The final start, join and deadline dates are confirmed in the official announcement before creators can join.
              </p>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-[1.4fr_0.8fr]">
            <div>
              <SectionHeading eyebrow="The opportunity" title="Create useful content. Compete on clear rules." />
              <p className="mt-5 max-w-3xl leading-relaxed text-muted-foreground">{brief.overview || c.description}</p>
              {brief.audience && <InfoBlock title="Who you are talking to" text={brief.audience} />}
              {brief.keyMessage && <InfoBlock title="The one message" text={brief.keyMessage} />}

              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                <Card>
                  <CardHeader><CardTitle className="flex items-center gap-2 text-base"><FileCheck2 className="h-4 w-4 text-retail" /> Content directions</CardTitle></CardHeader>
                  <CardContent><List items={directions.length ? directions : ["Show a real business problem and how MartPoint addresses it.", "Use your own voice: demonstrate, explain, dramatise or document."]} /></CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Sparkles className="h-4 w-4 text-retail" /> Formats that work</CardTitle></CardHeader>
                  <CardContent><List items={exampleIdeas.length ? exampleIdeas : ["Short video or skit", "Screen recording or walkthrough", "Before-and-after explanation"]} /></CardContent>
                </Card>
              </div>
            </div>

            <Card className="h-fit border-retail/30 bg-retail-soft/20">
              <CardHeader><CardTitle className="flex items-center gap-2 text-base"><LockKeyhole className="h-4 w-4 text-retail" /> Who gets access</CardTitle></CardHeader>
              <CardContent className="space-y-4 text-sm">
                <p className="leading-relaxed text-muted-foreground">The challenge is not joined through the public application form. Access follows this path:</p>
                <ol className="space-y-3">
                  <Step number="1" title="Apply to the Creator Network" text="Submit your profile, audience and work." />
                  <Step number="2" title="Application review" text="The MartPoint team reviews fit and communication." />
                  <Step number="3" title="Activate your creator account" text="Approved applicants receive access to the Creator Portal." />
                  <Step number="4" title="Complete onboarding" text="Finish Creator Academy to become Creator Ready." />
                  <Step number="5" title="Join when live" text="The challenge appears in your portal when the join window opens." />
                </ol>
                <div className="border-t pt-4 text-xs leading-relaxed text-muted-foreground">Already applied? Do not apply again. Check your application status, respond to any follow-up, and complete onboarding after approval.</div>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="bg-muted/35 py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <SectionHeading eyebrow="Prize categories" title={`₦${(prizePool / 100).toLocaleString("en-NG")} across ${awards.length} ways to win`} description="Every award is one winner in Pilot 001. A creator may receive at most one cash award; if one creator tops multiple rankings, the next eligible creator receives the other award." />
            <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {awards.map((award, index) => (
                <Card key={award.id} className={index === 0 ? "border-retail/50 bg-card" : "bg-card/80"}>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between gap-3">
                      <span className="rounded-full bg-retail/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-retail">Award {index + 1}</span>
                      <Trophy className="h-5 w-5 text-retail" />
                    </div>
                    <h3 className="mt-4 text-lg font-semibold">{award.title}</h3>
                    <p className="mt-2 text-2xl font-bold">{money(award.cash_amount_kobo)}</p>
                    <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{award.description || award.judging_criteria}</p>
                    <p className="mt-4 border-t pt-3 text-xs leading-relaxed text-muted-foreground"><span className="font-semibold text-foreground">{awardExpectation(award).label}:</span> {awardExpectation(award).detail}</p>
                    {award.judging_criteria && <p className="mt-4 border-t pt-3 text-xs leading-relaxed text-muted-foreground"><span className="font-semibold text-foreground">Decided by:</span> {award.judging_criteria}</p>}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <SectionHeading eyebrow="Rules at a glance" title="Know exactly what is required" />
              <div className="mt-7 grid gap-4 sm:grid-cols-2">
                <Rule title="Eligible creators" text={c.creator_ready_required ? "Approved Creator Network members who have completed onboarding and are Creator Ready." : "Approved Creator Network members."} />
                <Rule title="Eligible platforms" text={platforms.join(", ") || "The official brief will confirm platforms."} />
                <Rule title="Submissions" text={`Submit ${c.min_submissions || 1}–${c.max_submissions || "unlimited"} public posts. Only submissions that pass review can be considered for awards.`} />
                <Rule title="Required CTA" text={c.required_cta || "The official brief will confirm the required call to action."} />
                <Rule title="Required tags" text={[...hashtags, ...mentions].join(" · ") || "The official brief will confirm required tags."} />
                <Rule title="Judging" text={c.judging_criteria || "Human judges and verified performance data, as stated in the final brief."} />
              </div>
              {requiredElements.length > 0 && <div className="mt-6 rounded-xl border bg-card p-5"><h3 className="font-semibold">Every submission must include</h3><div className="mt-4"><List items={requiredElements} /></div></div>}
              {c.content_requirements && <InfoBlock title="Content requirements" text={c.content_requirements} />}
              {c.prohibited_claims && <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-5"><h3 className="font-semibold text-red-900">Not allowed</h3><p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-red-800">{c.prohibited_claims}</p></div>}
            </div>

            <Card className="h-fit">
              <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Clock3 className="h-4 w-4 text-retail" /> Challenge timeline</CardTitle></CardHeader>
              <CardContent className="space-y-4 text-sm">
                <TimelineItem label="Planned activation" value={date(c.start_date)} note="Final date confirmed in the launch announcement." />
                <TimelineItem label="Join window closes" value={date(c.join_closes_at)} note="Creators must join during the official window." />
                <TimelineItem label="Submissions close" value={date(c.submission_deadline)} note="Submit public content before this deadline." />
                <TimelineItem label="Performance measured through" value={date(c.performance_cutoff)} note="Each post is measured on its comparable window." />
                <TimelineItem label="Winners announced" value={date(c.announcement_date)} note="After human judging and verification." />
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="bg-[#0A0F1C] py-16 text-white">
          <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
            <Scale className="mx-auto h-9 w-9 text-retail-light" />
            <h2 className="mt-4 text-3xl font-bold">Selection and rewards are separate decisions</h2>
            <p className="mx-auto mt-4 max-w-2xl leading-relaxed text-gray-300">Joining the Creator Network or this challenge never guarantees a prize. MartPoint selects creators for the network through application review. Pilot 001 winners are determined after the challenge using the published award basis, human judging and verified data.</p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Button asChild size="lg"><Link href="/creators/apply">Apply to Creator Network <ArrowRight className="h-4 w-4" /></Link></Button>
              <Button asChild size="lg" variant="outline" className="border-white/30 bg-transparent text-white hover:bg-white/10"><Link href="/creator/login">Creator Login</Link></Button>
            </div>
            <p className="mt-5 text-xs text-gray-400">Full versioned rules and terms are shown to eligible creators in the Creator Portal before joining.</p>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}

function Stat({ icon: Icon, value, label }: { icon: typeof Trophy; value: string; label: string }) {
  return <div className="min-w-0"><Icon className="h-5 w-5 text-retail" /><p className="mt-2 truncate text-lg font-bold sm:text-xl">{value}</p><p className="text-xs text-muted-foreground">{label}</p></div>
}

function SectionHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description?: string }) {
  return <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-retail">{eyebrow}</p><h2 className="mt-2 text-2xl font-bold tracking-tight md:text-3xl">{title}</h2>{description && <p className="mt-3 max-w-3xl leading-relaxed text-muted-foreground">{description}</p>}</div>
}

function InfoBlock({ title, text }: { title: string; text: string }) {
  return <div className="mt-6 rounded-xl border-l-4 border-retail bg-muted/30 p-4"><p className="text-sm font-semibold">{title}</p><p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{text}</p></div>
}

function Step({ number, title, text }: { number: string; title: string; text: string }) {
  return <li className="flex items-start gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-retail text-xs font-bold text-white">{number}</span><div><p className="font-medium">{title}</p><p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{text}</p></div></li>
}

function Rule({ title, text }: { title: string; text: string }) {
  return <div className="rounded-xl border bg-card p-4"><p className="text-sm font-semibold">{title}</p><p className="mt-1 text-sm leading-relaxed text-muted-foreground">{text}</p></div>
}

function TimelineItem({ label, value, note }: { label: string; value: string; note: string }) {
  return <div className="border-l-2 border-retail/30 pl-4"><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-1 font-semibold">{value}</p><p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{note}</p></div>
}
