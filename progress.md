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
