# Cashfree sandbox setup

For the subsequently approved production UPI activation, see [cashfree-live.md](cashfree-live.md). This document records the original sandbox setup; production mode was added in migration 020.

This implementation supports test payments only. It does not activate real UPI payments. After explicit approval, database migrations 018 and 019 were applied to the existing Burger Budds project on 2026-10-27. Hosting deployment and server credential configuration remain pending.

## Before enabling

1. Use a separate test deployment and test outlet/data. The public `burgerbudds.in` domain is deliberately blocked for sandbox checkout to prevent test transactions from funding real orders.
2. Verify the deployed schema and RPC definitions match the repository versions used by `create_order_atomic`, `create_order_legacy`, coin reservations and coupon redemptions. Repository migration files do not establish deployed state.
3. Review and explicitly approve applying `018_cashfree_payment_method.sql`, commit it, then apply `019_cashfree_sandbox.sql`. Do not combine the new enum value and its use into one transaction. Back up and test against a disposable database first.

Existing-project target selected on 2026-10-27: Burger Budds (`fyhkxqygoqmllxjfybyt`). Before migration, read-only inspection found the older guest-capable `create_order_atomic`, no `create_order_legacy`, no `cashfree_payments`, and no `coin_reservations`/`coupon_redemptions`. The new Cashfree transaction calls the existing order RPC; coupon cleanup is conditional on that optional table existing. Do not apply unrelated migration 013 merely to enable Cashfree. User approved the live DB decision, then 018 and 019 were applied separately through the Management API. Supabase migration-history tracking does not exist in this project; do not blindly rerun 019 or push all repository migrations. A targeted pre-change schema snapshot is saved in ignored `.data/cashfree-migration-backups/`; it is not a full database backup.
4. Configure these server-only environment variables through the hosting provider's secret settings (never `NEXT_PUBLIC_*`): `CASHFREE_CLIENT_ID`, `CASHFREE_CLIENT_SECRET`, `CASHFREE_ENV=sandbox`, `CASHFREE_SITE_URL=https://your-test-domain`, `CASHFREE_ENABLED=true`. Use only sandbox credentials. No credentials belong in committed files, browser code or logs. Configure the existing Supabase server credentials separately.
5. Whitelist the test domain in Cashfree. Configure the payment webhook at `https://your-test-domain/api/payments/cashfree/webhook`, with Cashfree's signed payment callbacks. Create Order also passes this notify URL. Local testing needs an HTTPS tunnel/test deployment for callbacks; do not expose production data through a tunnel.

## Flow and controls

The server reuses existing authoritative pricing, guest/user ownership and order validation. A dedicated transaction creates an order and its outlet-scoped payment record atomically. Pending Cashfree orders are filtered out of merchant API responses, and a database trigger prevents unpaid fulfilment, including direct transition RPCs. Checkout shows an explicit Test label. COD behavior remains unchanged.

Provider order IDs and idempotency keys are fixed to the stored order. The server creates or retrieves the Cashfree session; only its owning customer browser can request checkout or reconciliation. API calls are sandbox-only, with timeouts and sanitized errors. No real production gateway endpoint is included.

Callbacks use HMAC-SHA256 of the exact raw body and timestamp. Browser redirects and posted amounts never prove payment. Reconciliation fetches the Cashfree order and payment list, matches order ID, amount and INR, then calls a row-locked service-role-only SQL function. Duplicate confirmations do not add events or debit coins twice. Paid status never changes back because an individual attempt failed. Replayed signed callbacks are safe because reconciliation and confirmation are idempotent.

Cancelled/rejected orders are never reopened by late success. Such successful payments are recorded with `refund_required=true`. Automatic refunds are not implemented; reconcile and refund through the Cashfree test dashboard/support process. Customer and merchant UI must not describe these as refunded before provider confirmation.

Sessions expire after 20 minutes. Status reconciliation cancels a provider-expired session or an expired local order never created at the provider, releasing coin reservations and unused coupon redemptions. A customer can cancel an unpaid order from tracking. Abandoned orders not revisited and without a provider expiry callback require operational reconciliation/cancellation; do not enable at scale until scheduled reconciliation is configured. No scheduler or live cleanup job is installed by this change.

## Required validation before deployment

- Run `npm test`, `npm run typecheck`, and the web build. These mocks do not prove SQL/RLS or provider integration.
- On a disposable migrated database, test concurrent duplicate creation and concurrent webhook/status confirmations: one payment row/event and one wallet debit; same request key with another method must fail.
- Test signed success, forged/raw-body-modified callback, mismatched amount/currency, failed attempt followed by success, provider timeout, browser close, payment expiry, cancellation followed by late success, and customer ownership across users/guest cookies/outlets.
- Check unpaid orders are absent from merchant API responses and every transition RPC rejects unpaid fulfilment. Realtime subscribers must refresh through the scoped API rather than fulfil directly from raw row events.
- Complete a real Cashfree **sandbox** checkout on the whitelisted test site, verify webhook delivery and tracking, then verify COD still works. Do not use a mock pass as proof of a successful Cashfree payment.

To disable new checkout, set `CASHFREE_ENABLED=false`; retain sandbox credentials, callbacks and reconciliation for already-started payments. Do not drop payment records or remove enum values as a rollback. Real-money activation requires a separately reviewed production configuration, credentials, reconciliation and refund operations, database approval and deployment approval.

Sources checked 2026-10-27: [Cashfree hosted checkout](https://www.cashfree.com/docs/payments/online/web/redirect), [webhook signatures](https://www.cashfree.com/docs/payments/online/webhooks/signature-verification).

## Change inventory

- `src/lib/cashfree.ts`: server config, provider API, HMAC and payment validation.
- `src/lib/cashfree-orders.ts`: customer ownership, checkout session and reconciliation.
- `src/lib/cashfree-checkout.ts`: browser SDK loading and sandbox checkout.
- `src/app/api/payments/cashfree/route.ts`: public availability and owned session creation.
- `src/app/api/payments/cashfree/status/route.ts`: owned server-side status verification.
- `src/app/api/payments/cashfree/webhook/route.ts`: signed callback reconciliation.
- `src/components/payments/CashfreePayment.tsx`: payment retry, verification and recovery states.
- `src/app/api/orders/route.ts`: gateway validation, pending transaction and merchant visibility.
- `src/app/checkout/[cartId]/page.tsx`: payment choice and payment-aware idempotency.
- `src/app/track/[orderId]/page.tsx`: pending/verified payment status before the kitchen timeline.
- `src/app/merchant/page.tsx`: accurate pending/test-paid labels.
- `src/types/database.ts`: Cashfree method type.
- `supabase/migrations/018_cashfree_payment_method.sql` and `019_cashfree_sandbox.sql`: enum, service-only payment records, atomic confirmation and fulfilment guards; applied to the approved Burger Budds project on 2026-10-27. Treat these applied migrations as immutable.
- `tests/cashfree.test.cjs`, `tests/order-placement.test.cjs`, `package.json`: validation and regression coverage in the project test command.
- `docs/cashfree-sandbox.md`: this setup, limitations and deployment checklist.
- `.agent-memory/{changelog,decisions,file-index,gotchas}.md` and `.agent-memory/knowledge/payments.md`: verified scope and research cache, without credentials.

Validation on 2026-10-27: 54 tests passed, TypeScript check and production web build passed. Local API checks returned disabled sandbox config, 404 for an invalid/unowned order, 401 for an unsigned callback, and 503 for an unconfigured session. After approved DB application, verified the Cashfree enum, RLS enabled, trigger installed, anon/authenticated RPC/table access denied and service-role RPC access allowed. A temporary-table transaction proved unpaid fulfilment rejection and cancelled/paid guard paths, then rolled back. Payment records remained zero; no real order or payment was created. SQL concurrency and end-to-end provider checkout remain unverified. No deployment or push was performed.

Proposed AGENTS.md Section 3 addition (requires user approval; not applied): `src/app/api/payments/cashfree/, src/lib/cashfree*.ts, src/components/payments/ · Sandbox checkout and verified payment reconciliation; money/auth/DB-sensitive.`
