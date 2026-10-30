# Existing-site UPI activation

Approved scope: production UPI on https://www.burgerbudds.in using Vercel project `burger-budds` in `pawan-team1` and the existing Supabase project `fyhkxqygoqmllxjfybyt`. No new site, database project or GitHub push is required. Applied migrations 018/019 remain immutable; migration 020 adds production environment support.

## Secure production settings

In Vercel's **Production** environment, set the live values of `CASHFREE_CLIENT_ID` and `CASHFREE_CLIENT_SECRET` through the secure settings UI. Never use `NEXT_PUBLIC_` for these values or paste secrets in chat. Also set `CASHFREE_ENV=production`, `CASHFREE_SITE_URL=https://www.burgerbudds.in` and `CASHFREE_ENABLED=true`. Redeploy after settings change. The existing Supabase production server variables remain required.

Cashfree must approve the exact current website domain for live checkout. Use production/live API keys, not TEST keys. The live callback URL is `https://www.burgerbudds.in/api/payments/cashfree/webhook`; order creation passes this notify URL. Ensure the live dashboard's signed payment callbacks are enabled. Checkout restricts the order's payment methods to `upi`.

## Controls and validation

Production uses `https://api.cashfree.com/pg`; sandbox uses its separate endpoint. Configuration rejects test keys in production, live keys in sandbox, sandbox on the customer domain and production on an unapproved origin. Server credentials are never included in availability/session responses.

Each Cashfree record and order stores its environment. A mismatch stops provider access and confirmation. Amount, INR, provider identity and successful transaction are verified server-side, including on signed callbacks and customer status refresh. Pending online orders cannot be fulfilled. COD remains supported. Cancelled orders are not reopened after late success; `refund_required` requires operational reconciliation. Automatic refunds and scheduled abandoned-order reconciliation are not part of this activation.

Before publishing, run the tests, typecheck, web build and database checks. Check the deployed `/api/payments/cashfree` returns `enabled:true, mode:"production"`, checkout displays UPI, unsigned callbacks return 401, and invalid/unauthorised session access cannot reveal a session. A successful build is not evidence of a settled real payment. The owner must complete the first real UPI transaction and check both the Cashfree dashboard and merchant order state; do not charge a test payment without their instruction.

`.vercelignore` excludes local environment files, private `.data`, agent memory, desktop builds, SQL and tests from source upload. Deploy directly to the approved existing project; do not use `git push` to trigger deployment without a fresh push request. A Vercel CLI install/use was explicitly approved for this task.

Disable new checkout with `CASHFREE_ENABLED=false` if activation checks fail. Keep production credentials and callbacks available to reconcile already-started payments. Do not roll production transactions back to sandbox, remove payment history or edit applied migrations.

References checked 2026-10-27: [Cashfree hosted checkout](https://www.cashfree.com/docs/payments/online/web/redirect), [Cashfree order payment-method controls](https://github.com/cashfree/cashfree-pg-sdk-nodejs/blob/main/docs/Orders.md).

## Current verified state (2026-10-27)

- Production source implemented; current workspace's 60-test suite and TypeScript check passed, then 17 targeted payment checks passed including credential whitespace/HMAC normalization. Final Vercel cloud build/typecheck/deployment passed.
- Migration 020 applied to the approved existing database after a targeted schema/function snapshot. Temporary constraint probes were rolled back; production/sandbox constraints, RLS and service-only confirmation access passed. No real order/payment was created; payment records were zero.
- Vercel CLI use/install explicitly approved. Existing authenticated account `pawan-333` and `pawan-team1/burger-budds` verified; local project linkage points to `prj_WVzGQDHqNCjzPsCHSBcuMOoVEktN`.
- Owner subsequently supplied LIVE credentials and authorized configuration. A read-only authenticated lookup against the live Cashfree API verified them; no provider order or charge was created. Values were transferred via echo-disabled transient console input and encrypted Vercel Production settings, without credential files or secret output. They were not copied into Preview.
- Attempts to set the three non-secret Cashfree settings via Vercel API returned Invalid JSON (400) twice. Stopped retries under AGENTS.md; owner should save those settings in the secure UI together with the live keys, then confirm readiness. Secret values were never retrieved or displayed.
- Production settings are now complete: live keys saved as encrypted secrets; `CASHFREE_ENV=production`, `CASHFREE_SITE_URL=https://www.burgerbudds.in`, `CASHFREE_ENABLED=true`.
- Production deployment READY: `dpl_Ad2j7Hr5dM6KqZGkaK2y2YvgDzdv`, aliased to https://www.burgerbudds.in. The public payment configuration returned `enabled:true, mode:production`; website HTTP200, unsigned webhook401 and invalid/unowned session/status404 were verified. No real payment was charged by the agent. First real checkout/settlement, domain-whitelist approval and dashboard callback delivery still need owner verification; do not claim a settled transaction.
- The user pasted a live secret into chat. Recommend rotating it in Cashfree and securely updating the Vercel Production secret followed by redeployment; do not copy that value into documentation, memory, source or reports.

Changed files for live activation: `src/lib/cashfree.ts`, `src/lib/cashfree-orders.ts`, `src/lib/cashfree-checkout.ts`, `src/app/api/payments/cashfree/route.ts`, `src/app/api/orders/route.ts`, `src/types/database.ts`, `src/app/checkout/[cartId]/page.tsx`, `src/app/merchant/page.tsx`, `src/components/payments/CashfreePayment.tsx`, `src/app/track/[orderId]/page.tsx`, `tests/cashfree.test.cjs`, `tests/order-placement.test.cjs`, `supabase/migrations/020_cashfree_production.sql`, `.vercelignore`, this guide and task memory. Applied 018/019 were not edited.

## Test deployment requested 2026-10-27

Ready UI-only Preview: https://burger-budds-7dufvk6fy-pawan-team1.vercel.app (`dpl_HaVjF7MWVqpPcaX645BFEiLn4xrb`). Vercel authentication protection remains enabled. Cloud compilation, typecheck and deployment passed; 16 narrow payment tests passed after adding sandbox-only automatic preview-origin support. Production still requires its explicit approved origin.

Supabase and Cashfree credential variables were explicitly blanked at both build and runtime; Cashfree was disabled. This preview cannot process real orders/payments or demonstrate a working sandbox checkout. No production alias was promoted and no database change was made for this test deployment.

Automatic approval review rejected persistent copying of Production database secrets into Preview, then rejected an unpromoted Production-context deployment because both could expose/use production credentials without sufficiently explicit authorization for that secret-bearing test setup. Neither action ran; do not work around those rejections. Any further use of production credentials for testing requires explicit user approval of that access and a new approval review.

Screenshot-based TEST key extraction failed structural validation twice; no key values were displayed or saved. The actual sandbox checkout remains pending secure test-key configuration and an approved backend environment. Do not report UPI as active from this UI-only deployment.

Build lesson: root deployment exclusions must be anchored (`/supabase/`), otherwise they also exclude `src/lib/supabase` and break cloud compilation. The failed first preview was replaced by the Ready build linked above.
