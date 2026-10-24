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
