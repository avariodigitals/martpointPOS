# Paystack funds routing

## Keep the two payment owners separate

- **MartPoint receivables:** invoices issued from Next Admin, including invoices
  converted from quotes, Central credit invoices and Central add-on invoices.
  These payments are collected by MartPoint and do not use a merchant subaccount.
- **Merchant receivables:** CI3 fleet sales invoices and storefront orders. The
  fleet's resolved payout account is a Paystack subaccount. Checkout sends the
  merchant subaccount plus MartPoint's configured platform fee.
- A quote is not a payment transaction. It becomes payable only when converted
  to an issued invoice.

## MartPoint invoice payment

Issued invoice emails and PDFs include `/pay/invoice/{invoice UUID}`, plus the
configured bank account instructions. The public page only displays invoice
payment details. It initializes Paystack server-side, checks the callback or
webhook against Paystack's verify endpoint, records a payment, allocates it,
issues a receipt, and posts the finance entries. A fully paid invoice linked to
a pending subscription activates that subscription and synchronizes its
entitlements. Paystack accepts NGN for this flow.

## Central credits and add-ons

Fleet Central creates the canonical invoice and request intent, then asks Next
Admin to initialize Paystack checkout. Next Admin records the checkout URL and
provider reference against that intent. Verification posts the payment,
accounting entries and an idempotent fulfillment outbox event. Central receives
the event and applies eligible SMS/email credits or Automation access. The
callback and configured webhook both use the same server-side verification
path; recovery retries incomplete accounting or fulfillment.

For test checkout, configure `CENTRAL_BILLING_TEST_MODE=true`,
`PAYSTACK_TEST_SECRET_KEY`, and `CENTRAL_BILLING_TEST_FLEET_IDS` containing only
the disposable test fleet IDs. Keep test fleets and data isolated from normal
merchant operations. Live checkout uses `PAYSTACK_SECRET_KEY` with an `sk_live_`
key. Next Admin and Central must share the same Paystack integration and
Central billing HMAC secret.

## Merchant checkout and release requirements

The CI3 fleet sends `subaccount`, a percentage share or flat transaction charge,
and the selected gateway-fee bearer during transaction initialization. Paystack
settles the merchant remainder to the merchant's subaccount bank destination.
This is provider settlement, not an immediate bank transfer. The fleet must
have migration 4.0.9.264 applied and its Paystack subaccount verified before
live checkout is enabled.

Paystack configures one webhook URL per integration. Configure the shared
integration to `/api/payments/webhooks/paystack` on Next Admin. Each fleet saves
its subaccount code back to its active Central installation mapping; Next Admin
uses the split data in successful payment events to forward the signed event to
the correct fleet's `/paystack/webhook`. This relay must be acceptance-tested
with a test split before the integration is used live. Customer browser
callbacks alone are not a recovery plan.
