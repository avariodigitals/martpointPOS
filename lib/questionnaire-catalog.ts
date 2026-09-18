// Shared questionnaire catalog — pure data, safe to import from client and server code.
// Used by lib/lead-questionnaire.ts (defaults) and the admin leads page (send modal).

export type QuestionnaireOptionStatus = "ready" | "coming-soon"

export interface QuestionnaireCatalogOption {
  name: string
  status: QuestionnaireOptionStatus
}

export const QUESTIONNAIRE_MODULES: QuestionnaireCatalogOption[] = [
  { name: "Point of Sale (POS)", status: "ready" },
  { name: "Inventory & Stock Management", status: "ready" },
  { name: "Multi-Branch Management", status: "ready" },
  { name: "Customer Loyalty & CRM", status: "ready" },
  { name: "Accounting & Finance", status: "ready" },
  { name: "Procurement & Suppliers", status: "ready" },
  { name: "Reporting & Analytics", status: "ready" },
  { name: "WhatsApp Shared Inbox", status: "ready" },
  { name: "Payroll", status: "coming-soon" },
  { name: "HR & Staff Management", status: "coming-soon" },
  { name: "Manufacturing / Production", status: "coming-soon" },
  { name: "Approvals & Workflow", status: "coming-soon" },
  { name: "Online Store / E-commerce", status: "coming-soon" },
]

export const QUESTIONNAIRE_ADDONS: QuestionnaireCatalogOption[] = [
  { name: "Product Upload / Bulk Data Entry", status: "ready" },
  { name: "Data Migration & Import", status: "ready" },
  { name: "Hardware Supply (POS terminals, printers, scanners)", status: "ready" },
  { name: "Onsite Installation & Setup", status: "ready" },
  { name: "Staff Training", status: "ready" },
  { name: "Dedicated Account Manager", status: "ready" },
  { name: "Priority Support", status: "ready" },
  { name: "Custom Integrations / API", status: "coming-soon" },
]

function optionStatuses(items: QuestionnaireCatalogOption[]): Record<string, QuestionnaireOptionStatus> {
  return Object.fromEntries(items.map((i) => [i.name, i.status]))
}

export interface AdvancedQuestionnaireField {
  name: string
  label: string
  type: string
  options?: string[]
  optionStatuses?: Record<string, QuestionnaireOptionStatus>
  required?: boolean
  default?: string | number | boolean
  helpText?: string
}

// Rendered before the "Special workflow / requirements" textarea.
// The section field draws an "Advanced" heading divider on the public form.
export const ADVANCED_QUESTIONNAIRE_FIELDS: AdvancedQuestionnaireField[] = [
  {
    name: "sectionAdvanced",
    label: "Advanced — Modules, Add-ons & Branding",
    type: "section",
    helpText: "Tell us which extras your business needs so we can prepare an accurate proposal.",
  },
  {
    name: "modulesRequired",
    label: "Which modules do you need? (select all that apply)",
    type: "multiselect",
    options: QUESTIONNAIRE_MODULES.map((m) => m.name),
    optionStatuses: optionStatuses(QUESTIONNAIRE_MODULES),
    helpText: "Items marked “Coming soon” are on our roadmap and can be added to your rollout plan.",
  },
  {
    name: "whitelabellingRequired",
    label: "Do you need whitelabelling (your own brand, logo & domain)?",
    type: "select",
    options: ["Yes — full whitelabel", "Yes — partial (logo & receipts only)", "No", "Not sure — need details"],
  },
  {
    name: "addonsRequired",
    label: "Which add-ons & services do you need? (select all that apply)",
    type: "multiselect",
    options: QUESTIONNAIRE_ADDONS.map((a) => a.name),
    optionStatuses: optionStatuses(QUESTIONNAIRE_ADDONS),
  },
]
