# Delivery collection rollout · 2026-11-02

Status: migration 022 applied on 2026-11-02 to verified Burger Budds project `fyhkxqygoqmllxjfybyt`, after explicit user approval. UPI sandbox setup skipped at the user's request. No deployment, real order mutation or provider payment performed.

Local LIVE update (2026-11-02): user explicitly approved using the supplied LIVE CSV credentials locally. Appended the approved production settings to ignored local server configuration without reading existing environment values or displaying secrets. Read-only Cashfree nonexistent-order GET returned authenticated `404 order_not_found`. Restarted localhost:3000; readiness returned `enabled:true, mode:production, setup:ready`. This verifies configuration/credential acceptance, not checkout domain approval, a successful customer payment or settlement. No charge/order/deploy was performed. Rider PIN setup is confirmed complete by the owner.

Checkout UI follow-up (2026-11-02): isolated synthetic guest cart verified UPI visible/enabled and Setup pending absent. Found guest desktop/mobile CTA labels hardcoded to COD even when `paymentMethod=cashfree`; fixed both in the checkout page to Continue to UPI. Browser verified UPI and COD switching on both CTAs, without order/payment submission (mutating order/payment requests blocked in the isolated page). Synthetic cart removed afterward. Typecheck, 84 root tests and production build passed. Actual gateway checkout/domain approval/payment and deployment remain unverified/pending.

## UPI diagnosis and sandbox setup

- `http://localhost:3000/api/payments/cashfree` returned `enabled:false, setup:disabled`.
- Separate dev server on port 3001 uses non-secret process flags `CASHFREE_ENABLED=true`, `CASHFREE_ENV=sandbox`, `CASHFREE_SITE_URL=http://localhost:3001`, `NEXT_BUILD_DIR=.next-sandbox`.
- Its readiness endpoint returned `enabled:false, setup:credentials_missing`. At least one sandbox credential is missing; existing secret values/files were not read or printed.
- Owner must securely set Cashfree **sandbox** `CASHFREE_CLIENT_ID` and `CASHFREE_CLIENT_SECRET` in local server settings (`.env.local`), preserving other settings. Never paste keys in chat or use LIVE keys for this test. Restart the sandbox dev process afterward; expected readiness is `enabled:true, mode:sandbox, setup:ready`.
- Cashfree domain approval and a reachable HTTPS sandbox site remain needed for a full customer-phone/callback test. `localhost` on a customer phone refers to that phone, not the development PC. No HTTPS tunnel/install/deploy was performed.
- Sandbox delivery UPI only accepts synthetic orders explicitly marked `payment_environment=sandbox`. Do not mark a real order as sandbox. Synthetic fixture creation in any database requires separate authorization.

## Collection behavior

- Original COD payment method stays COD. Collection method independently records `cash` or `upi_delivery`, timestamp, assigned rider ID and UPI reference.
- Cash is an assigned rider declaration of the full amount, atomically saved with delivery; it does not prove cash settlement with the store.
- Rider UPI requests Cashfree Order Pay's `qrcode` channel and displays Cashfree's returned PNG QR on the assigned rider page. Customer scans it with their UPI app; the rider checks status if the webhook has not refreshed the dashboard yet. No amount or payment state is trusted from the browser.
- Cashfree documents that Order Pay requires the account's S2S feature. Cashfree may deny QR creation until enabled for this merchant; account capability and a real device scan are not verified. Errors leave collection pending, so the rider must not confirm cash or delivery while a UPI attempt is open.
- Migration 023 prepares atomic Cashfree confirmation + auto-delivery for a timely, successful, rider-started delivery QR. Expired, cancelled, cash-conflicting, refunded, or stale payments are flagged for review and never auto-deliver. Migration 023 is prepared only; do not apply without separate approval and deployed-schema preflight.
- Only provider reconciliation can confirm UPI. Pending attempt blocks cash and delivery; use Check UPI payment. An expired attempt can be resolved and cash collected; fresh UPI retry after expiry currently needs store review.
- Duplicate callbacks/completion are idempotent. Late success after cash preserves the cash record and flags the payment for refund/review. Refunds are not automatic. Refunded orders block collection.
- Merchant card/CSV and super-admin recent-paid panel show collection source, rider, amount, time and reference. Admin panel also shows refund/review flags. Rider history shows collection source without customer contact/address.
- Assigned COD merchant/legacy delivery transitions must also have a collection record. Already-paid legacy COD with unknown collection source requires store review; historical collection sources are not invented/backfilled.

## Exact implementation inventory

- `src/lib/cashfree.ts`, `src/app/api/payments/cashfree/route.ts`, `src/app/checkout/[cartId]/page.tsx`: safe readiness codes; distinguish loading/request failure from incomplete setup.
- `src/lib/payment-collection.ts`, `src/types/database.ts`: collection labels and typed fields.
- `src/lib/cashfree-orders.ts`, `src/lib/cashfree-checkout.ts`: create/verify hosted sessions and Cashfree delivery QR.
- `src/app/api/rider/orders/[id]/payment/route.ts`: assigned-rider payment creation/checking; no client price/actor trust.
- `src/app/api/rider/orders/[id]/complete/route.ts`, `src/lib/rider-access.ts`, `src/app/rider/page.tsx`: cash declaration, QR/check, private DTOs and rider dashboard.
- `src/app/merchant/page.tsx`, `src/app/api/admin/route.ts`, `src/app/admin/page.tsx`: collection visibility and CSV; existing super-admin authorization preserved.
- `supabase/migrations/022_delivery_collection.sql`: new columns/purpose, service-only start/complete RPCs, payment confirmation/expiry extensions, legacy delivery guard.
- `tests/delivery-payment.test.cjs`, `tests/rider.test.cjs`, `tests/cashfree.test.cjs`: payment access, labeling, setup codes and completion regression coverage.
- `tests/delivery-collection-{preflight,postflight}.sql`, `tests/delivery-collection-db.test.sql`, `tests/run-delivery-collection-db-check.ps1`: schema/privilege checks and rollback-only synthetic temporary-table tests.
- This document and `.agent-memory/{file-index,decisions,gotchas,changelog,lessons}.md`, `knowledge/payments.md`: setup, evidence and task continuation.

## Database review and application completed

1. Authenticated Supabase CLI verified the project identity and read deployed columns, constraints, RPC definitions/grants, triggers and RLS. No collection columns/022 functions existed; the legacy 021 completion signature was present. No orders were out for delivery at that check.
2. Snapshot and deployed Cashfree update guard were cloned into temporary-table fixtures. The exact 022 body was redirected to `pg_temp`; every fixture and DDL was rolled back. Tests passed for assignment/outlet/disabled-account denial, cash with open UPI, duplicate delivery/callback, expiry without food-order cancellation, late-paid cash/refund, prepaid expiry compatibility, sandbox-vs-real order denial, zero COD and refunded orders.
3. User explicitly instructed migration application while skipping UPI setup. Applied only 022 in its transaction, with 5-second lock timeout and 30-second statement timeout. SHA256 recorded locally; authored migration left unchanged after application. No old migrations, history bulk-push or real order fixture writes.
4. Postflight verified four collection columns, non-null purpose, replacement completion signature, four service-only definer RPCs, all three RLS tables still enabled and both payment/delivery guards active. Existing Cashfree guard definition MD5 matched the preflight snapshot. PostgREST schema reload notification sent.
5. Pending: real provider payment/webhook verification, simultaneous multi-connection race tests and hosted code deployment. Old hosted rider clients cannot declare cash collection; unpaid-COD completion will fail safely until the matching app code is deployed. UPI credentials remain skipped.
6. Migration 023 is authored but not applied. Until it is separately reviewed/applied, verified delivery UPI does not auto-complete delivery in the database.

## Verification and limits

- TypeScript and final production web build passed; 84 root tests + 6 new delivery-payment tests passed.
- Isolated browser verified login screen, missing-credential readiness, anonymous rider API 401, synthetic customer payment link with TEST banner/no rider login, and fragment clearing. No Cashfree checkout/payment was requested.
- Authenticated installed Supabase CLI provided Management API SQL access. Temporary-table tests and actual live metadata/grant/guard postflight checks passed; no provider settlement or multi-connection race was tested. Live site's UPI configuration could not be reverified because network/SSL access failed.
- Rollback: disable new payment sessions, retain verification/webhooks and audit records. Do not blindly revert old rider client after applying 022; its delivery-only COD behavior is intentionally blocked. Schema rollback/delete needs separate approval.

## Proposed AGENTS patch (not applied)

- Section 3: add `src/app/rider/`, `src/app/api/rider/`, `src/lib/rider-access.ts` and `docs/delivery-collection.md` for rider/collection workflows.
- Section 5: include rider payment/collection APIs and atomic completion RPCs under money/core business rules.
- Section 6: replace stale root-test-count wording with the actual seven-file list; add that 022 is applied and matching rider code deployment/provider verification remain pending.

Sources: [Cashfree hosted checkout](https://www.cashfree.com/docs/payments/online/web/redirect), [webhook idempotency](https://www.cashfree.com/docs/payments/online/webhooks/webhook-indempotency), checked 2026-11-02.
