/* Store Setup questionnaire for onboarding.
 *
 * The questions now live in lib/store-setup-templates.ts as a per-business-type
 * registry (common core + industry layer), shared by the onboarding email and
 * the client onboarding form so the two can never drift apart.
 *
 * This module re-exports the generator for existing imports.
 */

export {
  generateSetupQuestions,
  getStoreSetupFields,
  getStoreSetupTemplate,
  resolveStoreSetupTemplateKey,
  STORE_SETUP_TEMPLATES,
  STORE_SETUP_COMMON,
  type StoreSetupField,
  type StoreSetupFieldType,
  type StoreSetupTemplate,
} from "./store-setup-templates"
