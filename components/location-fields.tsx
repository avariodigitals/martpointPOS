"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { COUNTRIES, getStatesForCountry, getCitiesForState } from "@/lib/locations"

interface LocationFieldsProps {
  country: string
  state: string
  city: string
  onChange: (values: { country?: string; state?: string; city?: string }) => void
  inputClassName?: string
  disabled?: boolean
}

const inputClsDefault =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-60"

export function LocationFields({
  country,
  state,
  city,
  onChange,
  inputClassName = inputClsDefault,
  disabled = false,
}: LocationFieldsProps) {
  const [customCities, setCustomCities] = useState<string[]>([])
  const [otherMode, setOtherMode] = useState(false)
  const requestedRef = useRef<Set<string>>(new Set())

  const stateOptions = useMemo(() => getStatesForCountry(country), [country])
  const canonicalCityOptions = useMemo(() => getCitiesForState(country, state), [country, state])
  const cityOptions = useMemo(() => {
    const merged = [...new Set([...canonicalCityOptions, ...customCities])]
    return merged
  }, [canonicalCityOptions, customCities])

  const hasCountry = Boolean(country) && COUNTRIES.some((c) => c.name === country)

  // Load admin-adopted custom cities for the selected country+state.
  useEffect(() => {
    let cancelled = false
    if (!country || !state) return
    fetch(`/api/locations/cities?country=${encodeURIComponent(country)}&state=${encodeURIComponent(state)}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return
        setCustomCities(d.success ? d.cities || [] : [])
      })
      .catch(() => {
        if (!cancelled) setCustomCities([])
      })
    return () => {
      cancelled = true
    }
  }, [country, state])

  // Whether the currently selected city is a known (canonical or adopted) city.
  const isKnown = city !== "" && cityOptions.some((c) => c.toLowerCase() === city.toLowerCase())
  // Type-in mode for the State when the selected country has no state list.
  const showOtherState = hasCountry && stateOptions.length === 0
  // Typing mode: "Other" chosen, or the current value isn't a known drop-down entry.
  const showOtherCity = hasCountry && state !== "" && (otherMode || (!isKnown && city !== ""))

  // Reset state when the selected country no longer supports the current state.
  // (Scheduled so the state update doesn't run synchronously in the effect body.)
  useEffect(() => {
    if (state && !stateOptions.includes(state)) {
      const timer = setTimeout(() => onChange({ state: "", city: "" }), 0)
      return () => clearTimeout(timer)
    }
  }, [country, stateOptions, state, onChange])

  const countryNames = useMemo(() => COUNTRIES.map((c) => c.name), [])

  // Route a custom city for admin authorisation (fire-and-forget, once per value).
  const requestCustomCity = (value: string) => {
    const trimmed = value.trim()
    if (!trimmed || !country || !state) return
    if (cityOptions.some((c) => c.toLowerCase() === trimmed.toLowerCase())) return
    const key = `${country}|${state}|${trimmed.toLowerCase()}`
    if (requestedRef.current.has(key)) return
    requestedRef.current.add(key)
    fetch("/api/locations/city-request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ country, state, city: trimmed }),
    }).catch(() => {})
  }

  return (
    <>
      <div>
        <label className="block text-xs font-medium mb-1">Country</label>
        <select
          disabled={disabled}
          className={inputClassName}
          value={country}
          onChange={(e) => {
            setOtherMode(false)
            onChange({ country: e.target.value, state: "", city: "" })
          }}
        >
          <option value="">Select country</option>
          {countryNames.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs font-medium mb-1">State</label>
        {!hasCountry ? (
          <select disabled className={inputClassName} value="">
            <option value="">Select country first</option>
          </select>
        ) : showOtherState ? (
          <input
            disabled={disabled}
            className={inputClassName}
            value={state}
            onChange={(e) => onChange({ state: e.target.value, city: "" })}
            placeholder="State / Province"
          />
        ) : (
          <select
            disabled={disabled}
            className={inputClassName}
            value={state}
            onChange={(e) => {
              setOtherMode(false)
              onChange({ state: e.target.value, city: "" })
            }}
          >
            <option value="">Select state</option>
            {stateOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        )}
      </div>

      <div>
        <label className="block text-xs font-medium mb-1">City</label>
        {!hasCountry || state === "" ? (
          <select disabled className={inputClassName} value="">
            <option value="">{!hasCountry ? "Select country first" : "Select state first"}</option>
          </select>
        ) : showOtherCity ? (
          <input
            disabled={disabled}
            className={inputClassName}
            value={city}
            onChange={(e) => onChange({ city: e.target.value })}
            onBlur={() => requestCustomCity(city)}
            placeholder="Type your city"
          />
        ) : (
          <select
            disabled={disabled}
            className={inputClassName}
            value={city}
            onChange={(e) => {
              if (e.target.value === "__other__") {
                setOtherMode(true)
                onChange({ city: "" })
              } else {
                setOtherMode(false)
                onChange({ city: e.target.value })
              }
            }}
          >
            <option value="">Select city</option>
            {cityOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
            <option value="__other__">Other</option>
          </select>
        )}
      </div>
    </>
  )
}
