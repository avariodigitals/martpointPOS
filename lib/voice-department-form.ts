export interface VoiceDepartmentForm {
  id?: string // Stable client-only row key; never sent as a routing identifier.
  digit: string
  label: string
  primary: string
  fallback: string
  enabled: boolean
}

export function firstAvailableDepartmentDigit(departments: VoiceDepartmentForm[]): number | null {
  const used = new Set(departments.map((department) => Number(department.digit)))
  for (let digit = 1; digit <= 8; digit++) if (!used.has(digit)) return digit
  return null
}

export function departmentFallbacks(value: string): string[] {
  return value.split(/[,\n]+/).map((item) => item.trim()).filter(Boolean)
}
