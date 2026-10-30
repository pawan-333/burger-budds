# Decisions and current scope
- This repository is Burger Budds, not CueTill. Preserve its actual Next.js/React stack.
- PLAN.md is the implementation specification; progress.md records work and limits.
- Phase sequence: 0,1,2,3,4(+12.1/12.2),9(+12.3/12.12),5,6,7,8,remaining12,11.
- User paused broad phase work. Later authorized runtime/duplicate-navigation and latency fixes only.
- User go after memory creation approved the pending responsiveness fix; broader phases remain paused.
- Phase commits exist for 0,1,2,3,4,9,5. These are implementations, not fully verified completed phases.
- Remaining phases: 6,7,8,remaining12,11, plus recorded incomplete tasks in earlier phases.
- Phase 10 ON HOLD: outlet placeholder fields/toggle only; no POS or rider integration.
- Cashfree sandbox/mock is required; implementation still pending. Do not add Razorpay integration.
- Brand collects money; track franchise payout per outlet. No invented commission.
- Coins shared brand-wide; price override requires brand permission; outlet offers need approval.
- Radius-based delivery with distance fees; all-veg presentation, other diet types supported in model.
- Outlet-specific data comes from records; never invent contact, hours, FSSAI or credentials.
- No live schema writes have been performed during this work; applied schema must be verified separately.
- User-provided AGENTS.md introduces scope/decision gates; roles run inline, no extra agent discussions.
- AGENTS.md contains CueTill/Vite/React18 facts that conflict with verified Burger Budds source.
- Preserve existing user edits and propose AGENTS.md corrections; never silently rewrite it.
- Tansen Nagar outlet added as active/closed. User later authorized manager provisioning; login verified. No menu copying.
- User confirmed Badagaon daily hours 11:00–21:30 India time on 2026-10-24; data applied, manual closure remains supported.

- 2026-10-24 user rule: fix and verify locally first. Push to GitHub only after a fresh explicit git push request; earlier approvals do not authorize later fixes.
- 2026-10-24 user confirmed Badagaon delivery radius 6km; saved and browser/API verified, other outlet settings unchanged.

- 2026-10-24 user set Badagaon free delivery from INR 349, otherwise flat INR 29 across its zone; no per-km surcharge. User explicitly requested no tests for this task.

- 2026-10-24 user approved only manual rider handover name/mobile and customer tracking display. Persist in existing atomic status-event note; no external rider integration or schema change.
- 2026-10-27 user approved Electron portable Windows merchant app at https://www.burgerbudds.in/merchant; hosted online app, sandbox enabled, no web auth/payment edits. Build needs Node >=22.12; bundled Node24 available. Runtime download blocked; await retry or alternative approval.
- 2026-10-27 approved Edge launcher replaces blocked Electron delivery: fixed HTTPS merchant URL, separate LocalAppData/BurgerBudds/Merchant/EdgeProfile, no forwarded arguments or shell execution; installed Edge + .NET4 required. Launcher compiled and window observed.
- 2026-10-27 Cashfree Gate2 approved sandbox code + migration preparation only; main live domain blocked for test payments. Live DB apply/deploy/production activation require separate approval. Keys remain server-side; actual provider checkout not tested.
- 2026-10-27 user explicitly approved existing Burger Budds live migrations018/019; applied and permissions/guard checked. Treat appliedSQL immutable; do not apply other migrations. Preview-site/server-secret setup still authorized but not completed; real-money production mode not approved.
- 2026-10-27 approve-live authorizes production UPI, migration020 and deployment only to pawan-team1/burger-budds; owner separately approved temporary VercelCLI. No GitHub push, new project or unrelated changes. Keys owner will save directly in Vercel Production; never request secrets in chat.
- 2026-10-27 user supplied actual live credentials after prior blockers; authorized Production-only configuration/deployment completed. No Preview secret replication. Live UPI configenabled onwww.burgerbudds.in; credentials never store in memory. Subsequent key rotation must update Vercel secret + redeploy.
- 2026-10-30 approved project-only ECC hooks: pre-commit secret scan; pre-push typecheck/test/build. Local ecc.hooksRoot pins ECC2.2.3; update after plugin removal/upgrade. SessionStart already registered/trusted; actual firing unverified. Separate AGENTS correction subsequently approved and completed; workflow gates preserved.
- 2026-10-30 user approved internal rider dashboard: provisioned email/password, own assignments, call/map/COD due/history, delivery-only completion and registered merchant selection; manual flow preserved. Separate rider_accounts mapping and service-role RPC migration021 prepared only. External rider integrations remain out of scope; live DB/provision/deploy need separate approval.

2026-10-30 · rider login uses mobile + private six-digit PIN; disabled phone provider requires dedicated internal email identities through existing password provider. Only super-admin sets PIN and activates pre-provisioned mapping; no shared/bootstrap PIN retained.
