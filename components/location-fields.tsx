"use client"

import { useEffect, useMemo, useState } from "react"
import { COUNTRIES, getStatesForCountry, getCitiesForState } from "@/lib/locations"

interface LocationFieldsProps {
  country: string
  state: string
  city: string
  onChange: (values: { country?: string; state?: string; city?: string }) => void
  inputClassName?: string
  disabled?: boolean
  required?: boolean
  showCountry?: boolean
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
  required = false,
  showCountry = true,
}: LocationFieldsProps) {
  const [customCities, setCustomCities] = useState<string[]>([])

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

  // Reset state when the selected country no longer supports the current state.
  // (Scheduled so the state update doesn't run synchronously in the effect body.)
  useEffect(() => {
    if (state && !stateOptions.includes(state)) {
      const timer = setTimeout(() => onChange({ state: "", city: "" }), 0)
      return () => clearTimeout(timer)
    }
  }, [country, stateOptions, state, onChange])

  const countryNames = useMemo(() => COUNTRIES.map((c) => c.name), [])

  return (
    <>
      {showCountry && <div>
        <label className="block text-xs font-medium mb-1">Country{required ? " *" : ""}</label>
        <select
          disabled={disabled}
          required={required}
          name="country"
          className={inputClassName}
          value={country}
          onChange={(e) => onChange({ country: e.target.value, state: "", city: "" })}
        >
          <option value="">Select country</option>
          {countryNames.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>}

      <div>
        <label className="block text-xs font-medium mb-1">State{required ? " *" : ""}</label>
        {!hasCountry ? (
          <select disabled required={required} name="state" className={inputClassName} value="">
            <option value="">Select country first</option>
          </select>
        ) : (
          <select
            disabled={disabled}
            required={required}
            name="state"
            className={inputClassName}
            value={state}
            onChange={(e) => onChange({ state: e.target.value, city: "" })}
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
        <label className="block text-xs font-medium mb-1">City{required ? " *" : ""}</label>
        {!hasCountry || state === "" ? (
          <select disabled required={required} name="city" className={inputClassName} value="">
            <option value="">{!hasCountry ? "Select country first" : "Select state first"}</option>
          </select>
        ) : (
          <select
            disabled={disabled}
            required={required}
            name="city"
            className={inputClassName}
            value={city}
            onChange={(e) => onChange({ city: e.target.value })}
          >
            <option value="">{cityOptions.length ? "Select city" : "No standard cities available"}</option>
            {cityOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        )}
      </div>
    </>
  )
}
