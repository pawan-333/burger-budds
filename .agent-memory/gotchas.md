# Verified gotchas
- Public read reproduced PGRST205 for outlet_menu_items; outlets query succeeded (2026-10-23).
- New migration files do not establish live schema state. New-schema reads need rollout compatibility.
- Menu fallback handles only missing catalog tables; permission/network/relationship failures remain errors.
- Supabase plain-object errors must become Error instances before reaching Next.js page boundaries.
- Duplicate /stores links combined; regression fix awaiting scoped commit.
- Polling now 15s with hidden-tab/overlap guards and abort cleanup; outlet realtime retained (2026-10-23).
- Original interrupted performance patch did not land; approved follow-up is now implemented and checked.
- Cold local dev compilation took about 65s; this does not establish production navigation performance.
- Badagaon API returned 200 with 83 items; outlet page returned 200 after compatibility fix.
- Warm /stores verified 200 at 1238ms; both menu APIs ~1.2s. Cold compilation dominates first dev load.
- Existing npm test script excludes the new menu-schema-compat test; invoke it explicitly.
- Typecheck and 13 targeted tests passed after approved responsiveness fix (2026-10-23).
- New tests are mocked; real RLS, payments, coin concurrency and provider delivery remain unverified.
- Temporary .next-bugfix-check is generated/untracked; do not read or commit it.
- Temporary validation browser/server on port 3105 were closed after checks.
- NEXT_BUILD_DIR is the actual build-directory variable; NEXT_DIST_DIR has no effect here.
- Dev server added a .next-bugfix-check type include to tsconfig.json; cleanup is pending.
- Preserve baseline edits: PLAN.md, next-env.d.ts, admin page/API; do not blanket-stage the working tree.
- Sandbox exec/apply_patch/Node tool initialization failed; approved elevated shell worked. Python unavailable.
- Phase 5 redemption percentage is hardcoded at default 20%; configurable setting wiring remains pending.
- Production build passed after latency fixes; live production latency and RLS/money flows remain unverified.
- Migration 014 data payload was applied via Supabase API, not migration-history tracking; SQL is idempotent.
- Merchant delivery radius label now reads the selected outlet record; actual Tansen zone was already centered correctly.
- Pause/Resume fix reopens on pause_minutes=0, preserves schedule enforcement, and shows failures instead of ignoring them.
- Production-mode localhost tabs keep old JS until reloaded; two merchant tabs showed old fixed Vinay Nagar label despite corrected build.
- Real logged-in Badagaon Pause/Resume verified after reload; other expired merchant tab needs re-login.
- Old address GPS used a 4s timeout and hid errors in mobile step 2; shared helper now gives bounded retry and step-1 feedback.
- Phone GPS on HTTP LAN URLs is blocked by browser secure-context rules; use HTTPS or manual pin, never bypass browser security.

- Checkout previously showed hardcoded INR 299/29 and item-only grand total after pricing failure. Local fix uses outlet rules and marks estimates; user waived runtime checks.

- Deployed coin_reservations table is missing (PGRST205, read-only confirmed 2026-10-24). Both quote and order routes skip wallet lookup when coins are off; wallet redemption remains blocked until its schema is deployed.

- transition_order/transition_public_order use rejection_reason as the generic status-event note too; manual rider snapshot uses rider-handover JSON there without modifying reject_reason on handover. Preserve that note when changing RPCs.
