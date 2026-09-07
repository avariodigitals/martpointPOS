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

  // Reset state when the selected country no longer supports the current state.
  useEffect(() => {
    if (state && !stateOptions.includes(state)) {
      onChange({ state: stateOptions[0] || "", city: "" })
    }
  }, [country, stateOptions, state, onChange])

  // Reset city when the selected state no longer supports the current city.
  useEffect(() => {
    if (city && !cityOptions.includes(city)) {
      onChange({ city: cityOptions[0] || "" })
    }
  }, [state, cityOptions, city, onChange])

  const showOtherState = stateOptions.length === 0
  const showOtherCity = cityOptions.length === 0

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
          {countryNames.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs font-medium mb-1">State</label>
        {showOtherState ? (
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
        {showOtherCity ? (
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
