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
