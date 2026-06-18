import { SectionHeader } from "@/components/shared/section-header"
import { Unlink, ArrowRight, Link2 } from "lucide-react"

export function SolutionFramework() {
  return (
    <section className="w-full bg-background py-16 md:py-24 lg:py-32">
      <div className="container-martpoint">
        <SectionHeader
          label="The Solution"
          headline="From scattered to connected. From guessing to knowing."
          description="MartPoint replaces the chaos of disconnected tools with one ecosystem that actually talks to itself."
        />

        <div className="mt-14">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-center">
            {/* Before */}
            <div className="rounded-2xl border border-border bg-muted p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center">
                  <Unlink className="w-5 h-5 text-destructive" />
                </div>
                <h3 className="text-lg font-bold text-foreground">Before</h3>
              </div>
              <ul className="space-y-4">
                {[
                  "Sales recorded in notebooks",
                  "Inventory counted once a month",
                  "Staff managed on WhatsApp",
                  "Reports built in Excel every weekend",
                  "No visibility across branches",
                ].map((item, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-3 text-sm text-muted-foreground"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-destructive mt-1.5 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Arrow */}
            <div className="hidden lg:flex justify-center">
              <div className="w-14 h-14 rounded-full bg-accent/10 flex items-center justify-center">
                <ArrowRight className="w-6 h-6 text-accent" />
              </div>
            </div>

            {/* After */}
            <div className="rounded-2xl border border-success/20 bg-success/5 p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
                  <Link2 className="w-5 h-5 text-success" />
                </div>
                <h3 className="text-lg font-bold text-foreground">With MartPoint</h3>
              </div>
              <ul className="space-y-4">
                {[
                  "Every sale logged automatically",
                  "Real-time stock across all branches",
                  "Staff schedules and approvals in one place",
                  "Reports generated instantly",
                  "Full business visibility from your phone",
                ].map((item, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-3 text-sm text-foreground"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-success mt-1.5 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
