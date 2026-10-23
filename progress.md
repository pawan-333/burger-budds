# Burger Budds implementation progress

PLAN.md read fully on 2026-10-23. Sequence: 0,1,2,3,4 (+12.1/12.2),9 (+12.3/12.12),5,6,7,8,remaining 12,11.

## Decisions
Brand collects payments and tracks franchise payouts per outlet. BB Coins shared across outlets. Price overrides require brand permission. Outlet offers require approval. Radius delivery zones with distance fees. All-veg menu, other diets supported in data only when present. Phase 10 ON HOLD: fields/toggle only.

## Baseline
Next.js 15, React 19, TypeScript, Tailwind, Supabase, development JSON fallback. Migrations 001–008. Preserve existing uncommitted edits in PLAN.md, next-env.d.ts, admin/merchant pages, order/admin APIs and access tests. Changes to those files may share phase commits; unrelated baseline edits stay unstaged.
Sandbox shell, patch writer and Node tool fail to initialize; elevated shell works. Python unavailable; use installed Node. No production database changes will be silently applied.

## Phase status
Inspection complete. Implementation pending.

## Phase 0 — foundation implemented, DB execution pending
Added migration 009: outlet metadata, central catalog and outlet mapping, variant/add-on override storage, new roles and scoped RLS helpers. Preserves historical IDs. Existing seed already contains both outlets; contacts/licenses remain unverified and will not be invented. Files: migration 009, database.ts. Reviewed migration against 001–008; PostgreSQL execution not yet available. Remaining: database execution and role isolation verification.

## Phase 1 — outlet leak fixes implemented
Removed dummy contact and fixed FSSAI. Header/footer/address defaults read current outlet; change-outlet navigation added. India timezone day schedules and overnight hours now gate both UI and order creation, with manual pause. Files: outlet-hours.ts, seed-data, AppContext, layout/header/footer, AddressModal, ProfileDrawer, OrderMenuClient, orders API. Static review complete; full checks deferred to phase 11. Unknown Badagaon timings/contact/license deliberately shown as unconfirmed; orders fail closed until configured.

## Phase 2 — access hardening implemented, live isolation verification pending
Preserved existing merchant login/role guards and scoped order APIs. Added reusable server authorization for current/new roles, membership compatibility trigger, removed anonymous local order reads/mutations and local merchant writes. Revoked direct money/order/outlet edits; profile editing limited to contact fields. Files: access.ts, migration 010, menu/orders/status APIs, existing merchant and access tests. No credentials exposed. OTP rate limiting is implemented with Phase 9 auth layer. Remaining: real authenticated two-outlet RLS execution and integration tests.

## Phase 3 — menu controls implemented
Outlet stock and price routes now require scoped authorization and brand permission; customer menus merge central content with outlet availability/prices and variant overrides. Added brand catalog edit/publish API and transactional publish-to-selected/all RPC; legacy order item IDs preserved. Variant minimum price displayed as From. Files: menu/catalog routes, server-db, MenuItemCard, migration 011. Reviewed joins and outlet predicates; runtime checks follow. Remaining: catalog UI added with Phase 6, full DB publish tests.

## Phase 4 (+T12.1/T12.2) — routing implemented, address flow extended later
Landing GPS/saved-address/locality finder, nearest open radius-serviceable outlet with cancellable three-second redirect and no-outlet pickup fallback. Configurable Mapbox locality search (MAPBOX_ACCESS_TOKEN); missing config reported explicitly. Serviceability returns distance/fee/ETA. Locator retains map/cards/directions using outlet coordinates. Existing two-step pin/detail/save/delete address flow retained; removed misleading preset zones. Files: homepage, StoreFinder, locations/serviceability routes, server-db, stores. Remaining: map-provider runtime validation and someone-else recipient UI (Phase 12).

## Phase 9 (+T12.3/T12.12) — SEO and mobile login implemented
Per-outlet title/canonical/OG/index robots and Restaurant/Menu JSON-LD; dynamic outlet sitemap; theme color. Legal aliases and Contact page. Mobile SMS/WhatsApp primary, optional email, consent, server arithmetic security challenge, persistent Supabase rate-limit RPC, 30s resend UI, explicit non-production AUTH_MODE=mock. No invented credentials. Truecaller remains disabled: approved provider client/redirect configuration required; not presented as working. Files: SEO/layout/outlet/sitemap, auth route/rate limit, login modal/context, migration 012, env example, legal aliases/contact. Official Supabase phone-auth and Mapbox endpoint docs checked. Remaining: provider delivery testing, Truecaller OAuth, Lighthouse mobile measurement; image optimization Phase 8. Env: AUTH_MODE, AUTH_CHALLENGE_SECRET, MAPBOX_ACCESS_TOKEN, BRAND_SUPPORT_PHONE, Supabase URL/anon/service role; SMS and WhatsApp provider credentials configured in Supabase dashboard.

## Phase 5 — offers and shared coins implemented
Coupons scoped by outlet/approval/date/minimum with transactional usage/per-user/first-order enforcement. Offer headline generated from real rule. Brand-wide coins reserved at order creation, redeemed after paid, released on rejection/cancel and earned on delivered/paid; wallet values loaded server-side. Migration 013 and offers/wallet/pricing/menu/order/cart changes. Default redemption 20%, earn 5%; settings record created. Remaining: wire configurable redemption percentage in pricing (currently default), exercise concurrent RPCs and refund coin reversal in Phase 7.

## Paused-run bug fix — 2026-10-23
User reported menu runtime crash and duplicate /stores keys. Reproduced public read: outlets succeeds; outlet_menu_items returns PGRST205 (migration 009 not applied). Menu now uses existing outlet-scoped records only for explicitly missing catalog tables; permission/network/relationship errors remain failures and database errors become Error instances. Combined duplicate store navigation into one Store Locator / Change outlet entry. Files: server-db.ts, GlobalHeader.tsx, tests/menu-schema-compat.test.cjs. Broader phase work remains ON HOLD; no database migrations applied. Verification results below.

## Approved slow-response fix — 2026-10-23
Scope: server-db.ts, OrderMenuClient.tsx and page loading boundaries. Parallelized catalog/menu queries and deduplicated metadata/page reads within a render (React cache, no cross-request price cache). Visible-tab fallback polling now 15s instead of 2s (8x fewer scheduled requests), with overlap guard, timeout and unmount cancellation; outlet-scoped realtime remains immediate. Added accessible loading boundaries for navigation feedback. No auth, RLS, payment or database schema changes. Validation pending below. Broad phase implementation remains on hold.

### Responsiveness verification
TypeScript passed after correcting the effect closing syntax; 13 focused menu-schema/order-status tests passed. Warm localhost timings: /stores 1238ms, Badagaon menu API 1161ms (83 items), Vinay Nagar API 1201ms (10 items), all HTTP 200. Browser navigation Store Locator -> Badagaon menu verified. Cold /stores took 44s, of which 39s was development compilation; production timings are not inferred from these numbers. Temporary validation browser/server closed. Production build still running. No migrations or live DB writes performed.

Production build passed (Next.js 15.5.27, 24 static pages generated). Typecheck, 13 focused regression tests and diff whitespace checks passed. Cross-check: API identity remains outlet-scoped; no cross-request menu/price cache. Security review of this change: no new credentials, schema writes or authorization changes. Existing migration/provider/coins verification gaps remain outside this paused-phase task.

## Tansen Nagar outlet — 2026-10-23
User explicitly approved quick outlet creation; merchant ID/password to be created by user. Added idempotent data migration 014 with supplied address/phone and map coordinates from matching public listing. Duplicate checked; inserted only this outlet through existing server-only Supabase admin client using the exact migration payload. This applies the data record, not the Supabase migration-history ledger; SQL is safe to replay. No schema changes, roles, merchant accounts or existing outlets modified. Active in locator; ordering/delivery disabled and hours empty until configured. Menu not copied or invented. Vegan/kids-menu descriptors not added as schema lacks corresponding fields. Migration 009–013 deployment remains pending. Verified exact saved identity/phone/coordinates after write.

## Tansen Nagar merchant account — 2026-10-23
User explicitly requested provisioning and supplied a password meeting the existing 12-character minimum. Created through Supabase Auth admin API, confirmed email, and assigned legacy-compatible manager membership only to Tansen Nagar. Verified password sign-in, exactly one outlet membership and absence of super-admin access; signed out verification session. No credentials, account identifiers or session tokens stored in repository notes. No other outlet/account changes or schema changes.
