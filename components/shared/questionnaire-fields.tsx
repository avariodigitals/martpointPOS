"use client"

/**
 * Renders a list of questionnaire-style fields (the shapes produced by
 * lib/lead-questionnaire.ts and stored in `questionnaire_fields` /
 * `lead_question_rounds.fields`). Shared by the main questionnaire page
 * and the short "additional questions" page.
 */

export interface QuestionnaireFormField {
  name: string
  label: string
  type: string
  options?: string[]
  optionStatuses?: Record<string, string>
  required?: boolean
  default?: string | number | boolean
  helpText?: string
}

interface QuestionnaireFieldsProps {
  fields: QuestionnaireFormField[]
  responses: Record<string, unknown>
  onChange: (name: string, value: unknown) => void
}

export function QuestionnaireFields({ fields, responses, onChange }: QuestionnaireFieldsProps) {
  const toggleMulti = (name: string, option: string) => {
    const current = Array.isArray(responses[name]) ? (responses[name] as string[]) : []
    onChange(name, current.includes(option) ? current.filter((o) => o !== option) : [...current, option])
  }

  return (
    <>
      {fields.map((field) =>
        field.type === "section" ? (
          <div key={field.name} className="pt-4 mt-2 border-t border-border">
            <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">{field.label}</h3>
            {field.helpText && <p className="text-xs text-muted-foreground mt-1">{field.helpText}</p>}
          </div>
        ) : (
          <div key={field.name}>
            <label className="block text-sm font-medium mb-1">
              {field.label} {field.required && <span className="text-red-500">*</span>}
            </label>
            {field.helpText && <p className="text-xs text-muted-foreground mb-1.5">{field.helpText}</p>}
            {field.type === "textarea" ? (
              <textarea
                required={field.required}
                value={String(responses[field.name] ?? "")}
                onChange={(e) => onChange(field.name, e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px]"
              />
            ) : field.type === "multiselect" ? (
              <div className="rounded-md border border-input bg-background px-3 py-2 space-y-1.5">
                {field.options?.map((o) => {
                  const selected = Array.isArray(responses[field.name]) && (responses[field.name] as string[]).includes(o)
                  const status = field.optionStatuses?.[o]
                  return (
                    <label key={o} className="flex items-center gap-2 text-sm cursor-pointer py-0.5">
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleMulti(field.name, o)}
                        className="rounded border-input shrink-0"
                      />
                      <span className="flex-1">{o}</span>
                      {status === "coming-soon" && (
                        <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">
                          Coming soon
                        </span>
                      )}
                      {status === "ready" && (
                        <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">
                          Ready
                        </span>
                      )}
                    </label>
                  )
                })}
              </div>
            ) : field.type === "select" ? (
              <select
                required={field.required}
                value={String(responses[field.name] ?? (field.default || ""))}
                onChange={(e) => onChange(field.name, e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Select...</option>
                {field.options?.map((o) => (
                  <option key={o} value={o}>
                    {o}{field.optionStatuses?.[o] === "coming-soon" ? " (Coming soon)" : ""}
                  </option>
                ))}
              </select>
            ) : field.type === "boolean" ? (
              <select
                required={field.required}
                value={String(responses[field.name] ?? (field.default ? "Yes" : "No"))}
                onChange={(e) => onChange(field.name, e.target.value === "Yes")}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Select...</option>
                <option value="Yes">Yes</option>
                <option value="No">No</option>
              </select>
            ) : (
              <input
                type={field.type === "number" ? "number" : field.type === "date" ? "date" : field.type === "email" ? "email" : field.type === "tel" ? "tel" : "text"}
                required={field.required}
                value={String(responses[field.name] ?? (field.default || ""))}
                onChange={(e) => onChange(field.name, field.type === "number" ? Number(e.target.value) : e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            )}
          </div>
        )
      )}
    </>
  )
}
