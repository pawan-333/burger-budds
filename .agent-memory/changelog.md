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

2026-10-24 · COD order fix: skip wallet lookup when coins off · orders route, order-placement tests, progress/memory; 22 tests + typecheck pass; no real order or push.

2026-10-24 · approved manual rider name/mobile handover + customer tracking contact · merchant/status/track, order-rider helper and status tests; 29 tests/typecheck pass; no live order or push.

2026-10-24 · fresh commit/push authorization for pending COD fix and rider handover feature; source already covered by 29 focused tests/typecheck.
2026-10-27 · merchant desktop Gate 1+2 approved; URL www.burgerbudds.in/merchant · package.json + desktop/{package.json,main.cjs,offline.html,security.test.cjs,README.md,.gitignore}; 4 security tests/syntax/diff checks pass; EXE blocked by official GitHub runtime download timeout, stalled processes stopped; no push.
2026-10-27 · user authorized Electron retry; packager and direct official runtime downloads timed out, small range succeeded but chunk workaround failed; no EXE produced. Removed unexpected file:.. desktop dependency to keep website code out of package; runtime-cache ignored. Await connectivity or alternate approach approval.
2026-10-27 · user approved Edge alternative · desktop/MerchantLauncher.cs, build-edge.cjs, README, .gitignore and package.json; compiled 6144-byte release/Burger-Budds-Merchant.exe; launch confirmed MSEdge Merchant Dashboard window; UI inspection approval timeout, no login/print/live-order test; no push.
2026-10-27 · approved merchant EXE logo fix · desktop/build-edge.cjs + merchant.ico (16-256px from public/logo.png); rebuilt 62464-byte EXE and visually verified extracted icon; no web changes/push.
2026-10-27 · taskbar icon follow-up · MerchantLauncher.cs + build-edge.cjs; per-profile window icon and AppUserModel properties added; compilation and actual Edge launch pass; screenshot verification failed (capture timeout), taskbar appearance unverified. User switched to Cashfree integration; no push.
2026-10-27 · approved Cashfree sandbox implementation · exact inventory docs/cashfree-sandbox.md; 54 tests/typecheck/web build + localhost fail-closed checks pass. Migrations018/019 unapplied; no credential write, live order, provider payment, deployment or push; test site/DB setup pending.
2026-10-27 · approved new Cashfree test setup · Supabase read-only discovery found Burger Budds project fyhkxqygoqmllxjfybyt and no branches. cashfree-sandbox branch rejected402 (Pro required); standalone Burger Budds Cashfree Test rejected free active-project quota(2). No resource/schema/secret/hosting change. Await explicit unused-project pause choice or plan upgrade.
2026-10-27 · user selected existing Burger Budds project for Cashfree setup · read-only SQL on fyhkxqygoqmllxjfybyt: legacy guest create_order_atomic, enum cod/razorpay, no cashfree/coin_reservations/coupon_redemptions or create_order_legacy. Migration019 optional coupon cleanup guarded for legacy schema. No payment DB write; pending live018/019 Gate2 decision.
2026-10-27 · explicit live DB approval received; applied018 then019 separately to fyhkxqygoqmllxjfybyt. Targeted schema snapshot in ignored.data/cashfree-migration-backups. Enum/RLS/roles/temporary-table unpaid guard tests pass; rollback probe, payments0. No migration-history table. Hosting blocked: Vercel CLI not cached; browser Computer Use stopped due unknown current URL. No deployment/secret config/push.
2026-10-27 · user approved live UPI on current website + Vercel CLI use · production source and020 implemented/applied, 57 tests/typecheck/web build + temporary DB environment/ACL probes pass, payments0. Verified Vercel account/project, linked existingproject only. Five Cashfree Production vars absent at last check; owner saving keys. Non-secret env API write400InvalidJSON twice, stopped. No deployment/payment/push; await owner keys/settings saved. Exact inventory docs/cashfree-live.md.
2026-10-27 · user requested test deploy · safe UI-only Preview READY https://burger-budds-7dufvk6fy-pawan-team1.vercel.app dpl_HaVjF7MWVqpPcaX645BFEiLn4xrb; Vercelauth remains, credentials explicitly blank build/runtime, paymentsdisabled. Rootignore fix preserves src/lib/supabase; cloudbuild/typecheck +16 paymenttests pass. Auto-review rejected prod-secret Preview copy and prod-context testdeploy; neither ran. TEST OCR failedstructuralchecks, no values saved. No productionalias/DB changes/push; sandboxcheckout pending approvedbackend+keys.
2026-10-27 · approved merchant session fix · merchant page sends bearer session; orders GET/status verify token, preserve store checks; 401 clears orders and stops polling. Full58 + targeted18 tests/typecheck pass; build pending; scoped commit/push requested.
2026-10-27 · merchant session verification complete · production build passed; server validates bearer with Supabase, RLS/store membership retained; live browser session and deployed behavior unverified. Existing unrelated memory edits retained unstaged.
2026-10-27 · live UPI continue · Production variable-name check found Cashfree vars missing. Native vercel env add configured only ENVproduction, SITE_URLwww.burgerbudds.in, ENABLEDfalse; no secrets read/copied, no deployment. Owner asked to securely save2 LIVE keys (not TEST). Await saved confirmation; pending enable/deploy/provider verification.
2026-10-27 · approved refresh429 follow-up · src/lib/supabase/{client,refresh-fetch}.ts, context/AppContext.tsx, lib/merchant-access.ts, app/merchant/page.tsx, tests/{merchant-access,refresh-fetch}.test.cjs. Identical refresh dedupe + shared timestamp-only cooldown honoring Retry-After(min60s); redundant auth-event getUser removed; merchant429 pauses polling with feedback. 60 suite+8 focused tests/typecheck/build pass; live trigger/recovery unverified; no push/deploy for this follow-up.
2026-10-27 · explicit push approval · refresh429 fix committed44c75fe and pushed origin/main successfully;7 scoped files only, unrelated Cashfree/memory changes unstaged. Deployment/live browser recovery not verified.
2026-10-27 · owner supplied LIVE keys and requested activation · verifiedpair via read-only Cashfree404; encrypted VercelProduction secrets saved via echo-disabled transientstdin, no plaintextfile/secretoutput. Enableflagtrue; deployed dpl_Ad2j7Hr5dM6KqZGkaK2y2YvgDzdv towww.burgerbudds.in. 60tests/typecheck+17targeted and cloudbuild pass. Publicconfigenabledtrue/modeproduction; HTTP200/401/404 guards pass. No order/charge/push; owner firstpayment/domainwhitelist/callbackverification pending; secret rotation advised.
2026-10-30 · approved ECC repo hooks · .githooks/{pre-commit,pre-push,.gitattributes}; local Git config points to ECC2.2.3. 16 isolated checks pass; secret output redacted, required push checks fail closed. No real commit/push/project build/DB action; AGENTS correction pending.
2026-10-30 · approved AGENTS correction complete · replaced CueTill facts with Burger Budds stack/map/security/check commands and ECC hook notes; 39 paths/9 scripts verified, 14 sections and approval workflow preserved, diff checks pass. Docs only; no build/DB/push.
2026-10-30 · approved rider dashboard local implementation complete · exact inventory docs/rider-dashboard.md; root+rider tests/typecheck/web build pass, synthetic mobile flows and real localhost401/no-store verified. Migration021 unapplied; no provisioning/live order/DB write/deploy/push. AGENTS rider-path patch proposed in docs.

2026-10-30 · approved rider DB/PIN continuation · migration021 applied after temporary-table probes; three inactive Badagaon mappings verified; mobile/password identity and protected admin PIN activation added. Rider tests pass; final push checks pending. Owner private PIN setup remains.
