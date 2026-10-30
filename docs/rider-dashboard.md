# Rider dashboard

## Scope and files

- `src/app/rider/{page,layout}.tsx`: mobile + private 6-digit PIN sign-in, active assignments, customer call/navigation, COD due, delivery confirmation, recent history; private/noindex page.
- `src/app/api/rider/orders/route.ts`: authenticated, filtered dashboard data with no-store responses.
- `src/app/api/rider/orders/[id]/complete/route.ts`: bearer-authenticated completion; actor comes from verified Supabase identity.
- `src/app/api/riders/route.ts`: outlet-authorized registered rider options for a ready delivery order.
- `src/lib/rider-access.ts`, `src/lib/rider-login.ts`, `src/types/database.ts`: access checks and minimal rider data shapes.
- `src/components/merchant/RegisteredRiderPicker.tsx`, `src/app/merchant/page.tsx`, `src/app/api/orders/[id]/status/route.ts`: registered selection and atomic assignment; existing manual contact handover remains available.
- `supabase/migrations/021_rider_dashboard.sql`: private account mapping, assignment index and two service-role-only RPCs.
- `tests/rider.test.cjs`, `tests/order-status.test.cjs`: API/access/projection/merchant regression tests with mocked persistence.
- `src/app/admin/riders/page.tsx`, `src/app/api/admin/riders/route.ts`, `src/app/admin/page.tsx`: protected saved-rider PIN setup/activation and administration navigation.
- `package.json`: include rider regression tests in the normal test and pre-push check list.

## Database applied; private PIN setup required

After explicit user approval, migration 021 was applied on 2026-10-30 to verified Burger Budds project `fyhkxqygoqmllxjfybyt`. The three requested phone Auth users and Badagaon rider mappings were provisioned with discarded random bootstrap passwords. **Mappings remain inactive until the owner sets each private PIN.** No real orders were modified. Treat migration 021 as applied and immutable.

Actual schema compatibility, existing payment guards and absence of conflicting objects were checked first. Migration functions were tested with synthetic data against temporary cloned tables in a rollback-only transaction; post-apply RLS/grants and all three phone mappings were verified. Do not rerun 021, bulk-push other migrations or disable RLS/payment triggers.

Provision through the approved administrator workflow, without putting credentials in source or chat:

1. Create a dedicated confirmed-phone Supabase Auth user for any additional rider through an approved administrator operation, with the confirmed internal email identity returned by `riderLoginIdentity`; store staff memberships are not required or granted. Never auto-link an existing customer identity.
2. Create or select a `riders` row with a valid name and Indian phone number. Confirm `is_active=true`.
3. Link that rider ID, the verified Auth user ID and its allowed outlet ID in `rider_accounts`; keep `is_active=false` until PIN setup. One rider maps to one Auth user and one outlet. Never auto-link using a handover phone/name or editable profile metadata.
4. The super administrator opens `/admin/riders`, selects a saved rider, and sets a different private 6-digit PIN. The server verifies the Auth phone and internal email identity match, updates the Auth password and then activates the mapping. PINs are not returned, logged, stored in application tables, or shown after saving. Share each PIN privately with its rider. This uses Supabase Auth password hashing and provider throttling.
5. In merchant view, open **Hand Over to Rider** on a ready delivery order and select the registered rider. The server/RPC verifies staff access, outlet, active account and payment eligibility. Manual name/mobile entry remains available.
6. Sign in at `/rider` with the mobile number and PIN. The order appears only after registered handover. Old manual notes are not backfilled and do not grant dashboard access.

Phone-provider login is disabled in the verified project. The mobile form derives a dedicated `@riders.burgerbudds.invalid` identity and uses the existing email/password provider; this address does not receive mail. No SMS configuration was changed. All three pending accounts have matching confirmed identities.

## Behavior and security

- Assignment locks the order, writes `rider_id`, moves it to `out_for_delivery`, and saves the existing customer-tracking contact note in one transaction. A retry of the same assignment returns the saved order; conflicting/stale assignments fail.
- Completion locks the order and verifies current assignment, outlet, account and rider activity inside the transaction. Only `out_for_delivery -> delivered` is supported; an authorized retry is idempotent. A different rider cannot complete the order.
- These RPCs are callable only by `service_role`; the server supplies the identity obtained from Supabase `getUser`. Anonymous/authenticated direct execution and direct account-table access are revoked. Rider account RLS remains enabled.
- Completion changes delivery status/timestamp and adds one event. **It does not record COD collection or change payment status.** Existing merchant delivery behavior is unchanged. There is no cash settlement feature in this scope.
- Non-COD orders must be paid before assignment/completion. Existing Cashfree DB guards remain in place.
- Read queries filter both rider ID and outlet ID. History returns only order ID/number/time (latest 20 within 7 days); customer contact/address is returned only for active deliveries. Active results are limited to 100 with a visible overflow notice.
- No rider registration, live GPS tracking, payouts, reassign UI, or external rider provider is added. Deactivating `rider_accounts.is_active` blocks future requests; refresh removes already displayed data. Do not reuse rider identities or move outlet mappings while deliveries are outstanding.
- Missing migration/configuration fails closed. Registered selection shows an unavailable message while manual contact handover remains usable.

## Verification and rollback

Run `node --test tests/rider.test.cjs tests/order-status.test.cjs`, the existing `npm test` list, `npm run typecheck`, and the affected web build. Test mobile login, empty/active/history/error/offline UI with synthetic data only.

In an approved isolated database, verify grants/RLS, two riders/two outlets, inactive accounts, payment guards, simultaneous assignment/completion, retry event counts, and unchanged payment fields. Mocked tests do not establish real DB concurrency, deployed RLS or Auth provider behavior.

Before migration: revert only this feature's source changes if necessary; preserve unrelated work. After migration: disable affected account mappings and revert feature code while keeping mapping/event history. Any destructive schema rollback requires separate approval. No deploy, Git push or live delivery test is implied by local validation.

## Local validation — 2026-10-30

- Rider/access/handover tests and the existing root test suite pass; TypeScript and the Next.js production build pass.
- Isolated mobile browser at 390px: synthetic sign-in, assigned order, correct call/map URLs, no horizontal overflow, confirmation, one completion request on double-click, empty state, private history, service error and offline blocking verified.
- Real localhost endpoints reject unauthenticated dashboard/list/assignment/completion requests with 401 and no-store headers. Browser data/Auth responses were intercepted fixtures; no real rider login or delivery mutation occurred.
- Migration 021 is applied. PostgreSQL rollback-only fixtures verified wrong rider/outlet, inactive accounts, stale assignment/status, repeated completion, unchanged COD/online payment fields, and RPC grants. Actual account-table RLS, service-only RPC grants and payment-trigger preservation passed postflight checks. Simultaneous multi-connection races and real rider PIN login after owner setup remain unverified.
- Mobile/PIN form and protected setup tests verify phone normalization, PIN validation, super-admin/bearer requirements, identity matching, failure handling, and no PIN in responses. Owner PIN entry and the first real delivery remain pending.

## Proposed AGENTS.md updates — pending approval

- Section 3: add `src/app/rider/`, `src/app/api/rider/`, `src/app/api/riders/` and `src/lib/rider-access.ts` as the rider dashboard, assignment options and server access paths.
- Section 5: explicitly include rider-account provisioning, assignment/completion RPCs and registered merchant handover in auth/order-sensitive scope.
- Section 6: add that rider access requires applied migration 021, explicit Auth-to-rider/outlet provisioning and private PIN activation; manual handover notes do not grant access. The root test list now includes rider tests.
