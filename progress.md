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
