# Running task checklist
2026-10-23 · memory creation · documentation only; actual stack and paused status recorded.

## Current state
- [x] Read PLAN.md fully during initial implementation.
- [x] Commit phase implementations 0,1,2,3,4,9,5 (latest adbb1eb).
- [x] Reproduce missing-catalog runtime error using read-only public query.
- [x] Add narrow legacy-menu fallback and normalize database errors (uncommitted).
- [x] Combine duplicate /stores nav entry (uncommitted).
- [x] Remove unreachable local status code causing TypeScript errors (uncommitted).
- [x] Pass typecheck and 13 targeted tests; API/outlet smoke responses 200.
- [x] Prepare scoped commit for validated bug/latency fixes; preserve unrelated user edits.
- [x] Apply approved latency fix: parallel menu reads, per-render deduplication, visible non-overlapping polling, loading UI.
- [x] Warm /stores and both outlet APIs HTTP 200 at ~1.2s; browser locator-to-menu navigation verified.
- [ ] Clean temporary build config/output only within explicitly approved scope.
- [ ] Broader phases stay paused until user resumes them.

## Files in active bug-fix scope
server-db.ts, GlobalHeader.tsx, orders/[id]/status/route.ts, menu-schema-compat.test.cjs, progress.md.
Approved performance scope implemented: OrderMenuClient.tsx, server-db.ts, global/store/outlet loading boundaries.

2026-10-23 · responsiveness fix validated by typecheck/13 tests/browser; production build passed.

2026-10-23 · approved Tansen Nagar outlet creation · migration 014, progress.md; data-only Supabase insert, no merchant account.

2026-10-23 · user-approved Tansen Nagar manager provisioning · login and single-outlet membership verified; no credentials retained.

2026-10-23 · merchant radius label uses outlet record; commit/push requested · merchant/page.tsx and existing admin radius edits.

2026-10-24 · user-approved Badagaon hours 11:00–21:30 daily; accepting orders enabled · migration015, progress.md; 5 boundary checks passed.

2026-10-24 · approved merchant Pause/Resume repair · api/menu, merchant/page, outlet-controls tests; 7 controls + 9 order tests/typecheck passed; build pending.

2026-10-24 · merchant control build passed; 0df8f77 was pushed before user clarified local-only scope. No further pushes authorized. Next: run newest validation build on localhost for user testing.

2026-10-24 · actual Chrome localhost controls verified: Pause/CLOSED then Resume/OPEN; stale tab reload fixed radius label. No push.

2026-10-24 · radius report investigated: Chrome manager session denied /admin; Badagaon currently 10km. Await intended radius/admin login; no app changes or push.

2026-10-24 · user-confirmed Badagaon radius 6km saved · migration016, local API and real merchant screen verified; no push.

2026-10-24 · mobile GPS quick fix explicitly authorized with push · geolocation.ts, AddressModal, StoreFinder, geolocation tests; 18 focused tests, typecheck/build pass; mobile browser with simulated outlet GPS opens correct store and enables deliverable pin confirmation. Localhost updated; push authorized.

2026-10-24 · approved delivery dot → yellow/green pin + white center · DeliveryMap, progress/memory; typecheck/build pass; browser drag/zone recheck verified; push requested.

2026-10-24 · approved Badagaon delivery rule INR 349+/FREE, below INR 349 flat INR 29 · migration017, checkout, cart/price, progress/memory; DB saved; no tests/build/browser checks per user; no push.

2026-10-24 · fresh user request to commit/push the Badagaon delivery-fee and checkout fix; no additional tests requested or run.
