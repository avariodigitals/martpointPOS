import type { Metadata } from "next"
import Link from "next/link"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"

export const metadata: Metadata = {
  title: "Recruitment Privacy Notice | MartPoint Careers",
  description:
    "How MartPoint collects, uses and protects personal data submitted through our careers website.",
  alternates: { canonical: "/careers/privacy" },
}

const sections = [
  {
    title: "What we collect",
    body: [
      "When you apply for a vacancy or join our Talent Pool, we collect the information you provide: your name, contact details (email, phone, WhatsApp), location (state, LGA, city, residential area), education and work history, skills, availability, equipment ownership, answers to vacancy-specific screening questions, and documents you upload (such as your CV or cover letter).",
      "We do not collect sensitive identity documents (such as national ID, passport or BVN) during the initial public application. If a role ever requires such documents, the vacancy will state this clearly and explain why.",
    ],
  },
  {
    title: "How we use it",
    body: [
      "We use your information to evaluate your application, communicate with you about the recruitment process, conduct assessments and verification, and — where you have consented — maintain your profile in our Talent Pool and notify you about future roles or field deployments.",
      "Internal review notes, scores and assessment results are used only by authorised MartPoint team members and are never shared publicly.",
    ],
  },
  {
    title: "Consent",
    body: [
      "Submitting an application requires your consent to process your data for recruitment purposes. Joining the Talent Pool and receiving future vacancy notifications are separate, optional consents — you can choose either independently of applying.",
      "Your consent choices and the version of this notice you accepted are recorded with your application.",
    ],
  },
  {
    title: "Storage and security",
    body: [
      "Your data is stored securely. Uploaded documents such as CVs are held in private storage and are only accessible to authorised recruitment staff through time-limited links — they are never publicly accessible.",
    ],
  },
  {
    title: "Retention",
    body: [
      "Application data is retained for the duration of the recruitment exercise and a reasonable period afterwards, unless you ask us to remove it earlier. Talent Pool profiles are kept while your consent is active; you may withdraw consent at any time.",
    ],
  },
  {
    title: "Your rights",
    body: [
      "You may request access to, correction of, or deletion of your personal data, and you may withdraw consent for Talent Pool membership or notifications at any time by contacting us.",
    ],
  },
  {
    title: "Contact",
    body: [
      "For privacy questions or requests relating to recruitment data, contact careers@martpoint.com.ng or use our contact page.",
    ],
  },
]

export default function CareersPrivacyPage() {
  return (
    <>
      <Header />
      <main className="flex-1 bg-muted/30">
        <div className="container-martpoint py-12 md:py-16">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-10">
              <span className="inline-block text-xs font-semibold uppercase tracking-widest text-retail mb-3">
                Careers
              </span>
              <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-foreground">
                Recruitment Privacy Notice
              </h1>
              <p className="mt-3 text-muted-foreground">
                How MartPoint handles personal data submitted through our careers website.{" "}
                <span className="text-xs">(Version careers-privacy-v1)</span>
              </p>
            </div>

            <div className="rounded-xl border border-border bg-card p-6 md:p-10 space-y-8">
              {sections.map((s) => (
                <section key={s.title}>
                  <h2 className="text-lg font-semibold text-foreground mb-3">{s.title}</h2>
                  {s.body.map((p, i) => (
                    <p key={i} className="text-sm text-muted-foreground leading-relaxed mb-3 last:mb-0">
                      {p}
                    </p>
                  ))}
                </section>
              ))}
              <p className="text-sm text-muted-foreground border-t border-border pt-6">
                See also our general{" "}
                <Link href="/privacy-policy" className="text-retail underline underline-offset-2">Privacy Policy</Link>.
              </p>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
