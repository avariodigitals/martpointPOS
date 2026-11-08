# Central credit and Automation billing v2

## Ownership and wallet scope

Central remains the only authority for operational credit balances, reservations, usage, provider delivery and provider cost. A wallet is scoped to one Central fleet installation and store (`db_messaging_accounts` unique key `(fleet_id, store_id)`); neither this integration nor the Next mapping combines balances. `db_communication_wallets` and `db_communication_ledger` remain the unit wallet and unit ledger. The older `db_messaging_accounts.balance_kobo` / `db_messaging_ledger` money balance is a separate legacy path and is not converted or credited by v2.

After the explicit catalogue handoff, Next Admin owns commercial prices, tax, credit bundles, activation status, canonical invoices and invoice lines, payments, allocations, receipts and finance journals. The initial import preserves the existing Central values. Next publishes every later approved catalogue version to Central over the signed API; checkout and invoice creation fail closed while publication is pending or failed. A Central v2 payment does not post its cash value to Central's merchant collection ledger. Reporting should use Next invoices/payments for purchased value, Central unit wallets/ledger for remaining credits and usage, and existing Central messaging dispatch/provider data for delivery and provider costs. Do not add Central invoice totals to Next revenue reports.

`business_deployments` remains unchanged, including its current one-deployment-per-business constraint. `central_installation_mappings` carries the separate many-installations-to-one-business relationship and identifies each Central `(fleet_install_id, store_id)` independently.

## Contracts implemented

Central-to-Next requests use JSON POST, `X-Central-Timestamp` (Unix seconds), and `X-Central-Signature` = lowercase HMAC-SHA256 of `timestamp + LF + exact request pathname + LF + exact raw JSON body`, using `CENTRAL_BILLING_API_SECRET`. Requests expire after five minutes. Next Admin routes:

- `POST /api/internal/central-billing/catalogue` imports the exact effective Central SMS/Email rate, minimum, bundles and tax basis points. An identical repeat is idempotent; a changed source hash returns 409 and requires review.
- `GET/POST /api/admin/central-billing/catalogue` is Finance's catalogue control. It takes ownership after the Central import, validates price changes and publishes a signed snapshot to `/messaging_api/sync_billing_catalogue`. The ownership and audit rows live in `central_billing_catalogue_control` and `central_billing_catalogue_audit`.
- `POST /api/internal/central-billing/invoices` resolves the active installation/store mapping, validates the imported catalogue, and calls `central_create_credit_invoice`. The idempotency key is stable per Central installation, store and request key. Reusing it with another payload fails.
- `POST /api/internal/central-billing/addon-invoices` accepts only imported, enabled `AUTOMATION_PLAN` products and calls `central_create_addon_invoice`; licence products are not accepted.
- `POST /api/internal/central-billing/payments/verify` verifies the exact Paystack reference, NGN currency and invoice amount with Paystack before using the existing `recordPayment`, `confirmPayment`, allocation, receipt, finance transaction and journal functions.
- `POST /api/internal/central-billing/payments/manual-confirm` accepts only a signed request from Central. Central calls it from the `special_access()` protected manual-receipt review action and sends the stored receipt SHA-256 and review note; the receipt bytes stay in Central.
- Central fulfils signed events at `/messaging_api/fulfill_credit_purchase`. Central checks the invoice/business/store/request link and applies each invoice line at most once under the exact account row lock. A repeated line returns an acknowledged replay.
- Next Admin registers its own canonical invoice in Central through signed `/messaging_api/register_credit_invoice` before returning success, so Central can validate and fulfil the mapped store wallet.

The Next fulfilment outbox is durable. `/api/cron/central-billing-recovery` retries unposted invoice/payment journals and unacknowledged Central events, with backoff. The scheduled invocation uses the existing `CRON_SECRET` bearer convention. Payment, allocation, accounting and fulfilment are recorded separately on `central_billing_intents`.

Next Admin can create an invoice from an existing explicit installation mapping through `POST /api/admin/central-billing/invoices` (permission `finance:manage`). The route validates the imported price and tax snapshot, creates the canonical invoice, then registers that invoice with Central. Existing Admin payment recording discovers the canonical invoice, associates the payment with its Central intent, and queues the same fulfilment when the existing payment confirmation function runs. This endpoint is the backend contract; a dedicated credit-purchase screen in Admin is not included in this foundation.

## Catalogue and purchase behavior

The initial Central import reads effective runtime values from `db_communication_catalogue`, `db_communication_credit_rules`, `db_communication_credit_packages`, `db_messaging_settings` and configured Automation plans. It carries disabled credit products, bundles and unpriced Automation periods as disabled products. Values are copied without normalization. After Finance takes ownership, the Central Admin cannot replace those prices; it receives the Next snapshot. Central keeps workflow limits and templates operationally managed while Next controls the commercial Automation price, name and purchasability. Central's minimum custom top-up floor remains ₦5,000.

New SMS/Email recharge requests and priced Automation subscription requests use v2 after `next_billing_enabled=1`. V2 checkout accepts Paystack so the Next verification path is authoritative. Central imports only enabled Automation plans with a positive monthly or annual price; price/tax changes require the explicit replacement step. Manual Automation transfers require a receipt and the same Next invoice/finance confirmation before activation. A purchase and its request store `billing_mode`; old rows default to `legacy`, and old Paystack/Monnify pending rows continue through the old Central verifier/fulfilment path. Licence purchase, renewal and activation remain request-only.

## Future automation and licence contracts

Other add-ons (including currently unavailable social and setup offers) need their own typed catalogue and fulfilment contract before Central may sell them. Licence purchase/renewal still needs a request-only contract; do not reuse the Automation plan event as a licence activation command.

## Required configuration and rollout

Set matching secret values (never commit them): `CENTRAL_BILLING_API_URL` and `CENTRAL_BILLING_API_SECRET` in PHP Central; `CENTRAL_BILLING_API_SECRET`, `CENTRAL_BILLING_CENTRAL_URL`, `CENTRAL_BILLING_ENABLED=true`, `PAYSTACK_SECRET_KEY`, Supabase service-role settings and existing `CRON_SECRET` in Next Admin. Keep the Next flag false until mappings, catalogue and sandbox checks pass; the independent Central DB `next_billing_enabled` flag must also be enabled. No live configuration was changed as part of this code change.

Run Next migrations `182_central_billing_foundation.sql`, `183_central_billing_addons.sql` and `184_central_billing_catalogue_control.sql`, plus PHP migrations `4.0.9.256_central_credit_billing_foundation.sql`, `4.0.9.257_central_billing_addons.sql` and `4.0.9.259_central_billing_catalogue_control.sql`, on the appropriate databases. In Next Admin, create one mapping for each Central install/store under the owning business. In Central Communications admin, import the current catalogue into Next. Then open Finance → Commercial Finance → Central Billing Catalogue and take ownership; this publishes the snapshot back to Central. Review the displayed sync status before enabling `next_billing_enabled`. Keep both billing flags off until signed connectivity, mappings, payment verification and fulfilment have been exercised in a non-production environment.

## Recovery, gaps and rollback

- Central unavailable before invoice creation: the purchase fails closed; retry with the same Central request key. A lost invoice response is safe because Next's RPC returns the existing invoice for the same payload.
- Next unavailable after checkout or manual receipt: Central does not add units. Webhook/browser retries and Next's scheduled recovery continue the verified payment/fulfilment work. The customer must not pay again while the request is pending.
- Lost fulfilment acknowledgement: Next retries the persisted outbox payload; Central deduplicates on invoice line.
- Accounting failure after provider-confirmed payment: payment and invoice stay canonical; the intent remains pending/failed for the recovery cron. Check chart-of-account configuration and retry. Do not mark the payment failed or create another payment.
- Refunds, chargebacks, reversals and complimentary grant reversal do not yet claw back consumed Central units. Reconcile and perform the existing authorized finance reversal plus an audited Central adjustment until a dedicated reversal contract is added; never silently debit a wallet below zero.
- Provider delivery costs remain Central operational costs, not purchased-credit revenue. Current provider cost detail depends on the existing dispatch/provider reports; no new cost rollup was introduced.
- Roll back by first turning `next_billing_enabled` off. Existing v2 pending payments remain tagged `next` and must finish through Next verification/recovery; do not switch them to legacy. Keep canonical invoices/payments and migration rows for audit. Revert application code only after v2 intents are settled. Schema rollback/drop is not recommended after any invoice/payment exists.

Non-Automation service add-ons remain unavailable until a Central fulfilment contract exists. The existing social/setup catalogue entries are marked unavailable and are not sold by this flow. Admin-initiated credit purchase UI, refund/reversal credit adjustments, and live-provider validation remain follow-up work.
