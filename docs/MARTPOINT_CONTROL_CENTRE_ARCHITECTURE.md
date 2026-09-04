# MartPoint Control Centre Architecture

## Overview

The MartPoint system has three primary surfaces:

1. **Public Website** — marketing, lead capture, partner application, pricing, FAQs.
2. **Admin Control Centre** — internal operational source of truth for MartPoint staff.
3. **Partner Portal** — permission-based portal for approved partners.

## Canonical Entities

```
Lead
  → Business (canonical customer)
  → Partner

Partner
  → Partner User
  → Partner Lead
  → Partner Customer Assignment
  → Compliance Record

Business
  → Quote
  → Invoice
  → Payment
  → Subscription
  → Licence
  → Entitlement
  → Deployment
  → Onboarding
  → Support Ticket
  → Customer Success Profile
  → Compliance Record
  → Customer Incident

Commercial
  → Product / Plan / Add-on
  → Quote
  → Invoice
  → Payment
  → Subscription
  → Renewal
  → Commission
  → Payout
```

## Role Boundaries

- **MartPoint** owns pricing, invoicing, payment confirmation, licensing, deployment go-live, commissions, and sensitive support.
- **Partner** operates within granted capabilities and assignments.
- **Customer** interacts through MartPoint; no self-service portal in current scope.

## Technology

- Next.js 16 App Router
- TypeScript strict mode
- Supabase / PostgreSQL via service-role client
- Tailwind CSS + Radix UI components
- Lucide icons
- Recharts
- Vitest for unit tests

## Security Model

- Admin: signed HTTP-only session cookie; role-based page permissions.
- Partner: signed session; organisation status, user status, capabilities, assignments, and role permissions.
- Storage: private buckets with signed URLs generated server-side.
- RLS: enabled on most tables; service role used for privileged server operations with explicit authorization.
