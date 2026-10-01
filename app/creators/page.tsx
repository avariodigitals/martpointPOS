export const revalidate = 3600
import type { Metadata } from "next"
import Link from "next/link"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { SectionHeader } from "@/components/shared/section-header"
import { Button } from "@/components/ui/button"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import {
  ArrowRight,
  Camera,
  Check,
  ChevronDown,
  ClipboardCheck,
  GraduationCap,
  Megaphone,
  Rocket,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Trophy,
  Users,
  Wallet,
} from "lucide-react"

export const metadata: Metadata = {
  title: "MartPoint Creator Network — Create. Influence. Earn.",
  description:
    "Join the MartPoint Creator Network and create content that helps Nigerian businesses discover smarter ways to run their operations. Apply as a creator today.",
  alternates: { canonical: "/creators" },
}

const howItWorks = [
  {
    icon: ClipboardCheck,
    title: "Apply",
    text: "Tell us about yourself, your platforms and your audience. Every application is reviewed by a real person on our team.",
  },
  {
    icon: GraduationCap,
    title: "Learn MartPoint",
    text: "Approved creators complete a short guided onboarding — what MartPoint is, who it's built for, and how to talk about it accurately.",
  },
  {
    icon: Camera,
    title: "Join Challenges",
    text: "Pick up creator challenges with clear briefs: what to say, what not to claim, and how winners are judged.",
  },
  {
    icon: Trophy,
    title: "Get Recognised",
    text: "Published content is tracked against referrals and engagement. Top creators earn challenge rewards and climb creator levels.",
  },
]

const whoCanApply = [
  "You create content on TikTok, Instagram, YouTube, Facebook, X or LinkedIn",
  "Your audience includes business owners, traders, entrepreneurs or working professionals",
  "You're based in Nigeria — any state, not just Lagos",
  "You can explain ideas clearly in your own voice",
  "You're 18 or older",
]

const benefits = [
  {
    icon: Rocket,
    title: "Early access to campaigns",
    text: "Be first to know when new products, features and challenges launch.",
  },
  {
    icon: GraduationCap,
    title: "Free product training",
    text: "Learn business software, retail operations and SME finance — knowledge that makes you a better creator.",
  },
  {
    icon: Wallet,
    title: "Challenge rewards",
    text: "Individual challenges carry their own published rewards — cash prizes, bundles and recognition, defined per challenge.",
  },
  {
    icon: TrendingUp,
    title: "Creator progression",
    text: "Move from Starter to Ambassador as your approved content and verified results grow.",
  },
]

const faqs = [
  {
    q: "Is everyone who applies accepted?",
    a: "No. Applications are reviewed individually by the MartPoint team. An automated assistant helps our reviewers summarise applications, but a person always makes the final decision.",
  },
  {
    q: "Do creators get paid just for joining?",
    a: "No. Joining the network is free and doesn't come with a guaranteed payment. Rewards are attached to specific challenges and are defined in each challenge's published terms.",
  },
  {
    q: "I'm not in Lagos. Can I still apply?",
    a: "Absolutely. We actively want creators across all of Nigeria — audiences outside Lagos are valuable to us.",
  },
  {
    q: "How is content tracked?",
    a: "Approved creators get a unique referral code and tracking link. When someone reaches MartPoint through your content, that visit can be attributed to you.",
  },
  {
    q: "What kind of content works?",
    a: "Honest, clear content in your own style — how a shop tracks stock, how a restaurant manages expenses, what a POS actually does. Challenges include briefs with examples and rules.",
  },
  {
    q: "What can't I say about MartPoint?",
    a: "Every challenge brief lists prohibited claims. In general: never invent features, prices or guarantees. Your Creator Kit contains approved descriptions.",
  },
]

async function getFeaturedChallenge() {
  if (!isSupabaseConfigured()) return null
  const { data } = await supabase
    .from("creator_challenges")
    .select("name, slug, description, theme, submission_deadline, status")
    .eq("featured", true)
    .in("status", ["ACTIVE", "SCHEDULED"])
    .order("start_date", { ascending: false })
    .limit(1)
    .maybeSingle()
  return data
}

export default async function CreatorsPage() {
  const featured = await getFeaturedChallenge()

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Hero */}
      <section className="relative overflow-hidden bg-[#070B14] text-white">
        {/* Ambient glows */}
        <div className="pointer-events-none absolute -top-32 -left-32 h-[480px] w-[480px] rounded-full bg-retail/25 blur-[120px]" />
        <div className="pointer-events-none absolute -bottom-40 -right-24 h-[420px] w-[420px] rounded-full bg-indigo-500/20 blur-[120px]" />
        {/* Subtle grid */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.15]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
            maskImage: "radial-gradient(ellipse 80% 60% at 50% 0%, black 40%, transparent 100%)",
            WebkitMaskImage: "radial-gradient(ellipse 80% 60% at 50% 0%, black 40%, transparent 100%)",
          }}
        />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16 md:pt-28 md:pb-24">
          <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-12 lg:gap-16 items-center">
            {/* Copy */}
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs font-medium text-white/80 backdrop-blur mb-6">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-retail-light opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-retail-light" />
                </span>
                Applications open — creators across Nigeria
              </div>

              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.02]">
                Create.
                <br />
                Influence.
                <br />
                <span className="bg-gradient-to-r from-retail-light via-amber-300 to-orange-400 bg-clip-text text-transparent">
                  Earn.
                </span>
              </h1>

              <p className="mt-6 text-lg md:text-xl text-white/70 leading-relaxed max-w-xl">
                Join the MartPoint Creator Network and make content that helps Nigerian
                businesses discover smarter ways to run their operations.
              </p>

              <div className="mt-8 flex flex-col sm:flex-row gap-3">
                <Button asChild size="lg" className="text-base shadow-lg shadow-retail/30">
                  <Link href="/creators/apply">
                    Apply as a Creator <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="text-base bg-white/5 text-white border-white/15 hover:bg-white/10 hover:border-white/25"
                >
                  <Link href="/creators/application-status">Check Application Status</Link>
                </Button>
              </div>

              {/* Platform chips */}
              <div className="mt-10">
                <p className="text-xs uppercase tracking-[0.18em] text-white/40 mb-3">
                  Your platform. Your voice.
                </p>
                <div className="flex flex-wrap gap-2">
                  {["TikTok", "Instagram", "YouTube", "Facebook", "X", "LinkedIn"].map((p) => (
                    <span
                      key={p}
                      className="rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-xs font-medium text-white/60"
                    >
                      {p}
                    </span>
                  ))}
                </div>
              </div>

              <p className="mt-8 text-xs text-white/40 max-w-md leading-relaxed">
                Admission is subject to review. Rewards depend on individual challenge
                terms — applying does not guarantee acceptance or payment.
              </p>
            </div>

            {/* Visual — creator dashboard mock */}
            <div className="relative hidden lg:block">
              <div className="pointer-events-none absolute inset-0 -m-6 rounded-[2rem] bg-gradient-to-tr from-retail/30 via-indigo-500/10 to-transparent blur-2xl" />

              <div className="relative rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl shadow-2xl p-6 rotate-1">
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-retail to-indigo-500 flex items-center justify-center text-sm font-bold">
                      MC
                    </div>
                    <div>
                      <p className="text-sm font-semibold">Creator Dashboard</p>
                      <p className="text-xs text-white/50">MPC-00234 · Level: Pro</p>
                    </div>
                  </div>
                  <span className="rounded-full bg-green-500/15 text-green-400 text-[10px] font-semibold px-2.5 py-1 uppercase tracking-wide">
                    Active
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3 mb-5">
                  {[
                    { label: "Clicks", value: "1,204" },
                    { label: "Leads", value: "38" },
                    { label: "Rewards", value: "₦75k" },
                  ].map((s) => (
                    <div
                      key={s.label}
                      className="rounded-xl border border-white/10 bg-white/[0.05] p-3 text-center"
                    >
                      <p className="text-lg font-bold">{s.value}</p>
                      <p className="text-[10px] uppercase tracking-wider text-white/50">
                        {s.label}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="rounded-xl border border-retail/30 bg-retail/10 p-4">
                  <p className="text-[10px] uppercase tracking-wider text-white/50 mb-1.5">
                    Your tracking link
                  </p>
                  <code className="block text-xs text-retail-light font-mono truncate">
                    martpoint.com.ng/?ref=MP-00234
                  </code>
                </div>
              </div>

              {/* Floating challenge card */}
              <div className="absolute -bottom-10 -left-8 w-64 rounded-xl border border-white/10 bg-[#0D1424]/95 backdrop-blur-xl shadow-2xl p-4 -rotate-2">
                <div className="flex items-center gap-2 text-amber-300 text-[10px] font-semibold uppercase tracking-wider mb-2">
                  <Trophy className="h-3.5 w-3.5" /> Live challenge
                </div>
                <p className="text-sm font-semibold leading-snug">
                  “Show your shop's real numbers” — ₦250k reward pool
                </p>
                <p className="mt-1.5 text-xs text-white/50">Submissions close in 12 days</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* What it is */}
      <section className="py-16 md:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeader
            headline="What is the MartPoint Creator Network?"
            description="A community of Nigerian content creators who help business owners understand what modern tools can do for them — honestly, and in their own voice."
          />
          <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {howItWorks.map((s) => (
              <div key={s.title} className="rounded-xl border bg-card p-6">
                <s.icon className="h-8 w-8 text-retail mb-4" />
                <h3 className="font-semibold mb-2">{s.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured challenge */}
      {featured && (
        <section className="py-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="rounded-2xl border-2 border-retail/40 bg-retail-soft/30 p-8 md:p-10">
              <div className="flex items-center gap-2 text-retail font-semibold text-sm uppercase tracking-wider mb-3">
                <Megaphone className="h-4 w-4" /> Featured Challenge
              </div>
              <h3 className="text-2xl md:text-3xl font-bold mb-3">{featured.name}</h3>
              {featured.theme && (
                <p className="text-sm font-medium text-retail mb-2">Theme: {featured.theme}</p>
              )}
              <p className="text-muted-foreground leading-relaxed max-w-3xl mb-4">
                {featured.description}
              </p>
              {featured.submission_deadline && (
                <p className="text-sm font-medium mb-6">
                  Submissions close:{" "}
                  {new Date(featured.submission_deadline).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              )}
              <Button asChild>
                <Link href="/creators/apply">
                  Apply to participate <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </section>
      )}

      {/* Who can apply + benefits */}
      <section className="py-16 md:py-20 bg-muted/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-2 gap-12">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold mb-6">Who can apply</h2>
            <ul className="space-y-3">
              {whoCanApply.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <Check className="h-5 w-5 text-retail mt-0.5 shrink-0" />
                  <span className="text-muted-foreground">{item}</span>
                </li>
              ))}
            </ul>
            <div className="mt-6 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
              <ShieldCheck className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
              <p className="text-sm text-amber-900">
                Every application is reviewed by a person. We look at your content style,
                audience fit and communication — not just follower counts.
              </p>
            </div>
          </div>
          <div>
            <h2 className="text-2xl md:text-3xl font-bold mb-6">Creator benefits</h2>
            <div className="space-y-4">
              {benefits.map((b) => (
                <div key={b.title} className="flex items-start gap-4 rounded-xl border bg-card p-5">
                  <b.icon className="h-6 w-6 text-retail mt-0.5 shrink-0" />
                  <div>
                    <h3 className="font-semibold">{b.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{b.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* How creators earn */}
      <section className="py-16 md:py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl md:text-3xl font-bold mb-6">How creators earn</h2>
          <div className="prose prose-neutral max-w-none text-muted-foreground space-y-4">
            <p>
              Creator Challenges are campaigns with a published brief, judging criteria and
              reward structure — for example an Overall Creator award, a Conversion Champion
              award or a Regional Champion award. Each challenge defines its own prizes.
            </p>
            <p>
              Your unique referral code and tracking link let us measure the real results of
              your content — visits, leads, demo bookings and sign-ups — which feed into
              challenge leaderboards and your creator level.
            </p>
            <p className="font-medium text-foreground">
              Important: joining the network does not guarantee payment. Earnings come only
              from challenge rewards and any referral programmes explicitly offered under
              published terms.
            </p>
          </div>
        </div>
      </section>

      {/* FAQs */}
      <section className="py-16 md:py-20 bg-muted/40">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl md:text-3xl font-bold mb-8">Frequently asked questions</h2>
          <div className="space-y-3">
            {faqs.map((f) => (
              <details key={f.q} className="group rounded-xl border bg-card">
                <summary className="flex items-center justify-between cursor-pointer p-5 font-medium list-none">
                  {f.q}
                  <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
                </summary>
                <p className="px-5 pb-5 text-sm text-muted-foreground leading-relaxed">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 md:py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Sparkles className="h-10 w-10 text-retail mx-auto mb-4" />
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Ready to create with us?</h2>
          <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
            Apply to the MartPoint Creator Network. Applications are reviewed by our team —
            tell us who you are and show us your best work.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button asChild size="lg" className="text-base">
              <Link href="/creators/apply">
                Apply as a Creator <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="text-base">
              <Link href="/creator/login">
                <Users className="mr-2 h-4 w-4" /> Creator Login
              </Link>
            </Button>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            Already applied? <Link href="/creators/application-status" className="text-retail underline">Check your status</Link>
          </p>
        </div>
      </section>

      <Footer />
    </div>
  )
}
