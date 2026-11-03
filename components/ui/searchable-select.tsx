"use client"

import { Children, forwardRef, isValidElement, useEffect, useId, useRef, useState, type ReactNode, type SelectHTMLAttributes } from "react"
import { Check, ChevronDown, Search } from "lucide-react"
import { cn } from "@/lib/utils"

type Option = { value: string; label: string; disabled: boolean }

function readOptions(children: ReactNode): Option[] {
  return Children.toArray(children).flatMap((child): Option[] => {
    if (!isValidElement<{ value?: string; children?: ReactNode; disabled?: boolean }>(child)) return []
    if (child.type === "option") {
      const label = Children.toArray(child.props.children).join("")
      return [{ value: String(child.props.value ?? label), label, disabled: !!child.props.disabled }]
    }
    return readOptions(child.props.children)
  })
}

/** Search only where the option list is long. Keep a real select for native
 * FormData, React Hook Form refs/validation and the existing change handlers.
 * The option panel stays inline, including inside narrow forms and modals. */
export const SearchableSelect = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function SearchableSelect({ children, className, value, defaultValue, disabled, onChange, onInvalid, ...props }, forwardedRef) {
    const generatedId = useId()
    const listId = `${generatedId}-options`
    const selectRef = useRef<HTMLSelectElement | null>(null)
    const triggerRef = useRef<HTMLButtonElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const [uncontrolledValue, setUncontrolledValue] = useState(String(defaultValue ?? ""))
    const [open, setOpen] = useState(false)
    const [query, setQuery] = useState("")
    const [active, setActive] = useState(0)
    const [invalid, setInvalid] = useState(false)
    const options = readOptions(children)
    const selectedValue = String(value ?? uncontrolledValue)
    const selected = options.find((option) => option.value === selectedValue)
    const words = query.toLowerCase().replace(/&/g, " and ").split(/\s+/).filter(Boolean)
    const filtered = options.filter((option) => !option.disabled && words.every((word) => option.label.toLowerCase().replace(/&/g, " and ").includes(word)))

    useEffect(() => {
      if (!open) return
      function outside(event: PointerEvent) {
        if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
      }
      document.addEventListener("pointerdown", outside)
      return () => document.removeEventListener("pointerdown", outside)
    }, [open])

    useEffect(() => {
      if (open) document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: "nearest" })
    }, [active, open, listId])

    function choose(next: string) {
      const select = selectRef.current
      if (!select) return
      // Dispatch a real select change so existing controlled and registered forms
      // receive the same event and value they used before this UI was introduced.
      select.value = next
      setUncontrolledValue(next)
      setInvalid(false)
      select.dispatchEvent(new Event("change", { bubbles: true }))
      setOpen(false)
      triggerRef.current?.focus()
    }

    return (
      <div ref={containerRef} className="min-w-0" onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false)
      }}>
        <select
          {...props}
          ref={(element) => {
            selectRef.current = element
            if (typeof forwardedRef === "function") forwardedRef(element)
            else if (forwardedRef) forwardedRef.current = element
          }}
          value={value}
          defaultValue={defaultValue}
          disabled={disabled}
          tabIndex={-1}
          aria-hidden="true"
          className="sr-only"
          onFocus={(event) => { props.onFocus?.(event); triggerRef.current?.focus() }}
          onChange={(event) => {
            setUncontrolledValue(event.target.value)
            setInvalid(false)
            onChange?.(event)
          }}
          onInvalid={(event) => {
            event.preventDefault()
            setInvalid(true)
            onInvalid?.(event)
            triggerRef.current?.focus()
          }}
        >{children}</select>
        <button
          ref={triggerRef}
          type="button"
          disabled={disabled}
          aria-label={props["aria-label"] ?? props.title ?? props.name ?? options.find((option) => option.value === "")?.label ?? "Select an option"}
          role="combobox"
          aria-required={props.required || undefined}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          aria-invalid={invalid || props["aria-invalid"] || undefined}
          aria-describedby={invalid ? `${generatedId}-error` : props["aria-describedby"]}
          className={cn("flex w-full min-w-0 items-center justify-between gap-2 text-left disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-retail/40", className)}
          onClick={() => { setOpen(!open); setQuery(""); setActive(0) }}
          onKeyDown={(event) => {
            if (["ArrowDown", "ArrowUp"].includes(event.key)) {
              event.preventDefault(); setOpen(true); setQuery(""); setActive(0)
            }
          }}
        >
          <span className="truncate">{selected?.label ?? (selectedValue || options[0]?.label || "Select an option")}</span>
          <ChevronDown aria-hidden="true" className={cn("h-4 w-4 shrink-0 transition-transform", open && "rotate-180")} />
        </button>
        {open && !disabled && (
          <div className="mt-1 w-full min-w-0 rounded-lg border border-border bg-card p-2 shadow-sm">
            <div className="flex items-center gap-2 rounded-md border border-border px-2">
              <Search aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" />
              <input
                autoFocus
                role="combobox"
                aria-label="Search options"
                aria-autocomplete="list"
                aria-expanded="true"
                aria-controls={listId}
                aria-activedescendant={filtered[active] ? `${listId}-${active}` : undefined}
                placeholder="Type to search…"
                value={query}
                className="w-full min-w-0 bg-transparent py-2 text-sm text-foreground outline-none"
                onChange={(event) => { setQuery(event.target.value); setActive(0) }}
                onKeyDown={(event) => {
                  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                    event.preventDefault()
                    setActive((current) => Math.max(0, Math.min(filtered.length - 1, current + (event.key === "ArrowDown" ? 1 : -1))))
                  } else if (event.key === "Enter") {
                    event.preventDefault()
                    if (filtered[active]) choose(filtered[active].value)
                  } else if (event.key === "Escape") {
                    event.preventDefault(); event.stopPropagation(); setOpen(false); triggerRef.current?.focus()
                  } else if (event.key === "Tab") setOpen(false)
                }}
              />
            </div>
            <ul id={listId} role="listbox" aria-label="Matching options" className="mt-1 max-h-52 overflow-y-auto overscroll-contain">
              {filtered.map((option, index) => (
                <li
                  id={`${listId}-${index}`}
                  key={`${option.value}-${index}`}
                  role="option"
                  aria-selected={option.value === selectedValue}
                  className={cn("flex cursor-pointer items-center justify-between gap-2 rounded-md px-2 py-2 text-sm break-words", index === active ? "bg-retail-soft text-foreground" : "text-muted-foreground hover:bg-muted")}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => choose(option.value)}
                >
                  <span>{option.label}</span>
                  {option.value === selectedValue && <Check aria-hidden="true" className="h-4 w-4 shrink-0 text-retail" />}
                </li>
              ))}
            </ul>
            <p role="status" className="px-2 pt-1 text-xs text-muted-foreground">{filtered.length ? `${filtered.length} options` : "No matches. Try a broader search."}</p>
          </div>
        )}
        {invalid && <p id={`${generatedId}-error`} className="mt-1 text-xs text-destructive">Please select an option.</p>}
      </div>
    )
  },
)
