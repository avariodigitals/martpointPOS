import { describe, expect, it } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { VoiceDepartmentsEditor } from "@/components/admin/voice-departments-editor"
import { departmentFallbacks, firstAvailableDepartmentDigit, type VoiceDepartmentForm } from "@/lib/voice-department-form"

const department = (digit: number): VoiceDepartmentForm => ({ id: `row-${digit}`, digit: String(digit), label: "Sales and demos", primary: "+2348000000001", fallback: "", enabled: true })
describe("Voice department routing form", () => {
  it("finds the first unused digit and reuses an option after removal", () => {
    expect(firstAvailableDepartmentDigit([])).toBe(1)
    expect(firstAvailableDepartmentDigit([department(1), department(3)])).toBe(2)
    expect(firstAvailableDepartmentDigit([department(2), department(3)])).toBe(1)
  })
  it("never offers the reserved repeat-menu digit", () => {
    expect(firstAvailableDepartmentDigit(Array.from({ length: 8 }, (_, index) => department(index + 1)))).toBeNull()
  })
  it("supports both existing comma-separated and new multiline backup editing", () => {
    expect(departmentFallbacks(" +2348000000001, agent@example.sip.africastalking.com\n+2348000000002\n , ")).toEqual(["+2348000000001", "agent@example.sip.africastalking.com", "+2348000000002"])
    expect(departmentFallbacks("")).toEqual([])
  })
  it("renders named labels, bounded fields and a textarea instead of a squeezed three-column row", () => {
    const html = renderToStaticMarkup(<VoiceDepartmentsEditor departments={[department(1)]} menuEnabled onChange={() => {}} onMenuChange={() => {}} />)
    for (const label of ["Keypad digit", "Department name", "Primary destination", "Backup destinations", "Enable this department"]) expect(html).toContain(label)
    expect(html).toContain("minmax(0,1fr)")
    expect(html).toContain("max-w-full")
    expect(html).toContain("<textarea")
    expect(html).not.toContain("md:grid-cols-[64px_1fr_1fr]")
    expect(html).toContain("@3xl:grid-cols-2")
  })
  it("keeps field ids stable when a keypad digit is edited", () => {
    const first = renderToStaticMarkup(<VoiceDepartmentsEditor departments={[department(1)]} menuEnabled onChange={() => {}} onMenuChange={() => {}} />)
    const second = renderToStaticMarkup(<VoiceDepartmentsEditor departments={[{ ...department(1), digit: "4" }]} menuEnabled onChange={() => {}} onMenuChange={() => {}} />)
    expect(first.match(/id="[^"]+-digit"/)?.[0]).toBe(second.match(/id="[^"]+-digit"/)?.[0])
  })
  it("provides an empty state and disables adding beyond eight routes", () => {
    const empty = renderToStaticMarkup(<VoiceDepartmentsEditor departments={[]} menuEnabled={false} onChange={() => {}} onMenuChange={() => {}} />)
    expect(empty).toContain("No departments added yet")
    const full = renderToStaticMarkup(<VoiceDepartmentsEditor departments={Array.from({ length: 8 }, (_, index) => department(index + 1))} menuEnabled onChange={() => {}} onMenuChange={() => {}} />)
    expect(full).toContain("All eight keypad options are in use")
    expect(full).toContain('disabled=""')
  })
})
