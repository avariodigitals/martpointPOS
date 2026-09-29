"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Briefcase, MapPin, Clock, Flame, Star, ArrowRight } from "lucide-react"
import type { CareerVacancy } from "@/lib/careers"
import {
  EMPLOYMENT_TYPE_LABELS,
  WORK_ARRANGEMENT_LABELS,
  formatCompensation,
} from "@/lib/careers"

const selectCls =
  "rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-retail/30"

function primaryLocation(v: CareerVacancy) {
  return v.locations?.find((l) => l.is_primary) || v.locations?.[0] || null
}

function locationLabel(v: CareerVacancy): string {
  const loc = primaryLocation(v)
  if (!loc) return "Nigeria"
  return [loc.city, loc.state].filter(Boolean).join(", ") || loc.country
}

function deadlineLabel(v: CareerVacancy): string | null {
  if (!v.application_closes_at) return null
  const d = new Date(v.application_closes_at)
  if (Number.isNaN(d.getTime())) return null
  return `Closes ${d.toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}`
}

export function VacancyBoard({ vacancies }: { vacancies: CareerVacancy[] }) {
  const [keyword, setKeyword] = useState("")
  const [state, setState] = useState("")
  const [city, setCity] = useState("")
  const [category, setCategory] = useState("")
  const [employmentType, setEmploymentType] = useState("")
  const [arrangement, setArrangement] = useState("")

  const states = useMemo(
    () => [...new Set(vacancies.flatMap((v) => (v.locations || []).map((l) => l.state).filter(Boolean) as string[]))].sort(),
    [vacancies]
  )
  const cities = useMemo(
    () =>
      [...new Set(
        vacancies
          .flatMap((v) => (v.locations || []).map((l) => (state && l.state !== state ? null : l.city)))
          .filter(Boolean) as string[]
      )].sort(),
    [vacancies, state]
  )
  const categories = useMemo(
    () => [...new Set(vacancies.map((v) => v.category_name).filter(Boolean) as string[])].sort(),
    [vacancies]
  )
  const employmentTypes = useMemo(
    () => [...new Set(vacancies.map((v) => v.employment_type))],
    [vacancies]
  )
  const arrangements = useMemo(
    () => [...new Set(vacancies.map((v) => v.work_arrangement))],
    [vacancies]
  )

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase()
    return vacancies.filter((v) => {
      if (kw && !`${v.title} ${v.short_summary || ""} ${v.department_name || ""}`.toLowerCase().includes(kw)) return false
      if (state && !(v.locations || []).some((l) => l.state === state)) return false
      if (city && !(v.locations || []).some((l) => l.city === city)) return false
      if (category && v.category_name !== category) return false
      if (employmentType && v.employment_type !== employmentType) return false
      if (arrangement && v.work_arrangement !== arrangement) return false
      return true
    })
  }, [vacancies, keyword, state, city, category, employmentType, arrangement])

  if (vacancies.length === 0) {
    return (
      <div className="mt-10 rounded-xl border border-border bg-card p-8 text-center">
        <Briefcase className="w-10 h-10 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-foreground mb-2">No Current Vacancies</h3>
        <p className="text-sm text-muted-foreground leading-relaxed max-w-md mx-auto mb-6">
          We are not actively hiring right now, but new roles and field deployments open regularly.
          Join our Talent Pool and we will contact you when a matching role opens.
        </p>
        <Button asChild variant="retail">
          <Link href="/careers/talent-pool">Join Our Talent Pool</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="mt-10">
      {/* Filters */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
        <input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="Keyword"
          className={`${selectCls} col-span-2 md:col-span-1`}
        />
        <select value={state} onChange={(e) => { setState(e.target.value); setCity("") }} className={selectCls}>
          <option value="">All states</option>
          {states.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={city} onChange={(e) => setCity(e.target.value)} className={selectCls}>
          <option value="">All cities</option>
          {cities.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={category} onChange={(e) => setCategory(e.target.value)} className={selectCls}>
          <option value="">All categories</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={employmentType} onChange={(e) => setEmploymentType(e.target.value)} className={selectCls}>
          <option value="">All types</option>
          {employmentTypes.map((t) => <option key={t} value={t}>{EMPLOYMENT_TYPE_LABELS[t]}</option>)}
        </select>
        <select value={arrangement} onChange={(e) => setArrangement(e.target.value)} className={selectCls}>
          <option value="">All arrangements</option>
          {arrangements.map((a) => <option key={a} value={a}>{WORK_ARRANGEMENT_LABELS[a]}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">No roles match your filters.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((v) => (
            <VacancyCard key={v.id} vacancy={v} />
          ))}
        </div>
      )}
    </div>
  )
}

function VacancyCard({ vacancy: v }: { vacancy: CareerVacancy }) {
  const compensation = formatCompensation(v)
  const deadline = deadlineLabel(v)

  return (
    <div className="rounded-xl border border-border bg-card p-5 md:p-6 transition-all duration-200 hover:border-retail/30 hover:shadow-sm">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-semibold text-foreground">{v.title}</h3>
              {v.urgent && (
                <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700">
                  <Flame className="w-3 h-3" /> Urgent
                </span>
              )}
              {v.featured && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                  <Star className="w-3 h-3" /> Featured
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {[v.department_name || v.category_name, EMPLOYMENT_TYPE_LABELS[v.employment_type], WORK_ARRANGEMENT_LABELS[v.work_arrangement]]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button asChild variant="outline" size="sm">
              <Link href={`/careers/jobs/${v.slug}`}>View Details</Link>
            </Button>
            <Button asChild variant="retail" size="sm">
              <Link href={`/careers/jobs/${v.slug}/apply`}>
                Apply <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </Button>
          </div>
        </div>

        {v.short_summary && (
          <p className="text-sm text-muted-foreground leading-relaxed">{v.short_summary}</p>
        )}

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5" /> {locationLabel(v)}
            {(v.locations?.length || 0) > 1 && ` +${(v.locations?.length || 1) - 1} more`}
          </span>
          {v.show_openings && (
            <span className="inline-flex items-center gap-1.5">
              <Briefcase className="w-3.5 h-3.5" /> {v.openings} {v.openings === 1 ? "opening" : "openings"}
            </span>
          )}
          {compensation && (
            <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
              {compensation}
            </span>
          )}
          {deadline && (
            <span className="inline-flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" /> {deadline}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
