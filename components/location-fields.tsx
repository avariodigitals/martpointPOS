"use client"

import { useEffect, useMemo } from "react"
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
  const stateOptions = useMemo(() => getStatesForCountry(country), [country])
  const cityOptions = useMemo(() => getCitiesForState(country, state), [country, state])

  const hasCountry = Boolean(country) && COUNTRIES.some((c) => c.name === country)

  // Reset state when the selected country no longer supports the current state.
  useEffect(() => {
    if (state && !stateOptions.includes(state)) {
      onChange({ state: "", city: "" })
    }
  }, [country, stateOptions, state, onChange])

  // Reset city when the selected state no longer supports the current city.
  useEffect(() => {
    if (city && !cityOptions.includes(city)) {
      onChange({ city: "" })
    }
  }, [state, cityOptions, city, onChange])

  const showOtherState = hasCountry && stateOptions.length === 0
  const showOtherCity = hasCountry && state !== "" && cityOptions.length === 0

  const countryNames = useMemo(() => COUNTRIES.map((c) => c.name), [])

  return (
    <>
      <div>
        <label className="block text-xs font-medium mb-1">Country</label>
        <select
          disabled={disabled}
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
            placeholder="City"
          />
        ) : (
          <select
            disabled={disabled}
            className={inputClassName}
            value={city}
            onChange={(e) => onChange({ city: e.target.value })}
          >
            <option value="">Select city</option>
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
