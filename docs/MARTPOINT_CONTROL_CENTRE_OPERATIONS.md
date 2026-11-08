# MartPoint Control Centre Operations Guide

## 1. Partner Application Handling

- Review new partner applications in **Partners → Applications**.
- Verify business name, contact, country, state, and partner type.
- Approve or reject. Rejected partners are not activated.
- Approved partners receive an invitation to create their organisation.

## 2. Partner Approval / Activation

- After approval, the partner record is `PENDING` until they accept the invitation and complete profile.
- Set the partner to `ACTIVE` to allow portal access.
- Suspend a partner to revoke all access without deleting data.

## 3. Partner User Invitation

- From **Partner → Users**, invite a user by email for the partner organisation.
- The user accepts the tokenised invitation and sets a password.
- Deactivate or suspend a user to remove access.

## 4. Lead Protection

- Partner leads appear in **Partners → Partner Leads**.
- MartPoint can protect a lead for a partner, mark it duplicate, or match it to an existing business.
- Protected leads prevent collisions between partners.

## 5. Customer Conversion

- Leads convert to `Businesses` in the businesses list.
- A business is the canonical customer record.
- Originating partner is recorded on the business where applicable.

## 6. Finance / Payment Confirmation

- Invoices and payments live in **Finance**.
- Only MartPoint admin can confirm a payment.
- Manual payment requires entering reference, amount, and method.
- Paystack and Flutterwave webhook handlers are implemented. Configure the provider secrets and callback URLs before relying on automatic payment updates; verify the invoice and payment record in Finance if a callback is delayed or rejected.

## 7. Subscription Activation

- After payment confirmation, activate the subscription in the finance module.
- Licences and entitlements are generated from the subscription.

## 8. Deployment Recording

- **Business 360 → Deployment** records deployment/provisioning status.
- A business is not "go-live" until deployment is approved.

## 9. Partner Assignment

- Use **Partner Customer Assignments** to give a partner view/onboarding/support access to a customer.
- Assignments can have start/expiry dates and access levels.
- Revoking an assignment removes partner access immediately.

## 10. Onboarding Review

- Partner-assisted onboarding records appear in **Onboarding**.
- MartPoint reviews and approves partner-completed onboarding.
- Training records can be added during onboarding.

## 11. Support Escalation

- **Support Desk** shows all support tickets.
- Partners with `FIRST_LINE_SUPPORT` can handle assigned non-sensitive tickets.
- Sensitive categories (Billing, Licensing, Security, Privacy, Partner Complaint) are MartPoint-only.
- Partners can escalate tickets; MartPoint retains ownership.

## 12. Compliance Review

- **Compliance** lists business and partner compliance requirements.
- Partners can submit documents; MartPoint verifies/rejects.
- Internal notes are not visible to partners.

## 13. Incident Handling

- **Incidents** records customer incidents.
- `SECURITY` and `DATA` incidents require the `support:sensitive` admin permission.
- Assign an owner, change severity/status, link a support ticket, resolve and close.

## 14. Commission Approval / Payout

- Commissions are calculated from configured rules.
- Review eligible commissions; approve then record payout.
- Commission attribution must be explicit (originating, sales, implementation).

## 15. Renewal Management

- Renewals appear in finance and customer success dashboards.
- MartPoint controls subscription renewals and pricing.

## 16. Suspension Procedures

- Suspend a partner or partner user to immediately revoke access.
- Suspended users cannot log in; suspended partners cannot access any API.
- Audit events record the suspension.

## 17. Quotation Approval

- Quotations that require approval appear in **Approvals & Workflows → Sales & Quotations**.
- Review the quote details and the requested action, then approve or reject with a decision note. The configured approver roles/users and approval policy determine who can decide.
- A quotation approval request does not itself create an invoice or record a payment. Continue with the quote's normal send/accept/convert steps after the approval is resolved.

## 18. Lead Contact Details and Messaging

- Lead records support an optional alternate phone number for staff reference. Keep the primary phone current; SMS campaigns and call campaigns continue to target the primary number unless a workflow explicitly says otherwise.
- In **Communications → SMS Campaigns**, system audiences are drawn from current lead/business/partner records. Before sending to a system audience, select the intended contacts and confirm they gave permission to receive SMS. That source record does not store their SMS opt-in.
- SMS campaign templates include general announcements and quote follow-up wording. Review the selected audience, message preview, sender and provider delivery result before treating a campaign as sent.
