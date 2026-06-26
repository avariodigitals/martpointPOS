"use client"

import { useEffect, useRef, useState } from "react"
import {
  CalendarClock,
  Building2,
  Users,
  ShieldCheck,
  Globe,
  MapPin,
} from "lucide-react"

/* ───────────────────────────  ANIMATED NUMBER  ─────────────────────────── */

function AnimatedNumber({ value, suffix = "" }: { value: number; suffix?: string }) {
  const [displayValue, setDisplayValue] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)
  const hasAnimated = useRef(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated.current) {
          hasAnimated.current = true
          const duration = 2000
          const start = performance.now()
          const animate = (now: number) => {
            const elapsed = now - start
            const progress = Math.min(elapsed / duration, 1)
            const eased = 1 - Math.pow(1 - progress, 3)
            setDisplayValue(Math.floor(eased * value))
            if (progress < 1) requestAnimationFrame(animate)
          }
          requestAnimationFrame(animate)
        }
      },
      { threshold: 0.3 }
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [value])

  return (
    <span ref={ref}>
      {displayValue}
      {suffix}
    </span>
  )
}

/* ───────────────────────────  METRICS DATA  ─────────────────────────── */

const metrics = [
  {
    icon: CalendarClock,
    value: 7,
    suffix: "+",
    extra: " Years",
    description: "Continuous Platform Engineering",
  },
  {
    icon: Building2,
    value: 100,
    suffix: "+",
    extra: "",
    description: "Enterprise & Retail Brands Served",
  },
  {
    icon: Users,
    value: 300,
    suffix: "+",
    extra: "",
    description: "Active Operations Professionals",
  },
  {
    icon: ShieldCheck,
    value: 100,
    suffix: "%",
    extra: "",
    description: "Verified System Uptime",
  },
  {
    icon: Globe,
    value: null as number | null,
    text: "24/7",
    description: "Cloud-Synced Business Visibility",
  },
  {
    icon: MapPin,
    value: 54,
    suffix: "+",
    extra: "",
    description: "African Markets Covered",
  },
]

/* ───────────────────────────  COMPONENT  ─────────────────────────── */

export function TrustLayer() {
  return (
    <section className="w-full bg-[#023047] py-16 md:py-24">
      <div className="container-martpoint">
        {/* Header */}
        <div className="max-w-3xl mx-auto text-center mb-14">
          <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold tracking-tight text-white">
            Trusted by Businesses That Demand Absolute Operational Control
          </h2>
          <p className="mt-4 text-lg text-white/70 leading-relaxed max-w-2xl mx-auto">
            Avario built MartPoint to engineer reliable POS and ERP retail management solutions. We empower growing businesses and commercial retail brands across Africa to eliminate stock leakage, unify multi-branch data, and make financial decisions with absolute clarity.
          </p>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-5">
          {metrics.map((metric) => (
            <div
              key={metric.description}
              className="group relative rounded-2xl border border-white/10 bg-white/5 p-6 text-center backdrop-blur-sm transition-all duration-300 hover:bg-white/10 hover:border-retail/40 hover:-translate-y-1"
            >
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-retail/20 transition-colors group-hover:bg-retail/30">
                <metric.icon className="h-5 w-5 text-white" />
              </div>
              <div className="text-3xl font-bold text-white mb-2">
                {metric.value !== null ? (
                  <>
                    <AnimatedNumber value={metric.value} suffix={metric.suffix} />
                    {metric.extra && <span className="text-lg font-medium ml-1">{metric.extra}</span>}
                  </>
                ) : (
                  <span>{metric.text}</span>
                )}
              </div>
              <p className="text-sm text-white/60 leading-relaxed">{metric.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
