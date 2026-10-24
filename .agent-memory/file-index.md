# Burger Budds file index
Verified from targeted source inspection on 2026-10-23; working tree includes uncommitted fixes.
PLAN.md · implementation source of truth; task IDs and order · verified@2026-10-23
progress.md · phase history, defaults, remaining work; not proof of validation · verified@2026-10-23
package.json · Next.js 15.5.27, React 19.3, TypeScript, Tailwind, Supabase; scripts · verified@2026-10-23
src/lib/server-db.ts · getMenuBundle, parallel catalog reads, per-render cache; legacy fallback · verified@2026-10-23
src/types/database.ts · outlet/menu/order types; read relevant slices only · verified@2026-10-23
src/lib/outlet-hours.ts · India-time schedule and manual-pause checks · verified@2026-10-23
src/lib/access.ts · scoped server authorization; new and legacy memberships · verified@2026-10-23
src/lib/pricing.ts · authoritative bill calculation and coupon validation · verified@2026-10-23
src/lib/wallet.ts · server-side available coins minus reservations · verified@2026-10-23
src/context/AppContext.tsx · customer outlet/cart/auth/address state; sensitive · verified@2026-10-23
src/components/layout/GlobalHeader.tsx · navigation; duplicate stores link fixed locally · verified@2026-10-23
src/components/menu/OrderMenuClient.tsx · menu/realtime; visible guarded 15s polling · verified@2026-10-23
src/app/api/menu/route.ts · public menu GET, authorized merchant PATCH · verified@2026-10-23
src/app/api/orders/route.ts · order validation, identity, atomic RPC call · verified@2026-10-23
src/app/api/orders/[id]/status/route.ts · authorized status transitions; dead code removed · verified@2026-10-23
src/app/api/auth/otp/route.ts · OTP send/verify, consent, security challenge · verified@2026-10-23
src/components/stores/StoreFinder.tsx · nearest-store location flow · verified@2026-10-23
src/app/order/[slug]/page.tsx · outlet page, metadata, structured data · verified@2026-10-23
supabase/migrations/009_multi_outlet_foundation.sql · new catalog/roles; unapplied locally · verified@2026-10-23
supabase/migrations/010_role_hardening.sql · grants and membership compatibility · verified@2026-10-23
supabase/migrations/011_menu_publish.sql · transactional central menu publishing · verified@2026-10-23
supabase/migrations/012_auth_rate_limits.sql · persistent OTP rate-limit RPC · verified@2026-10-23
supabase/migrations/013_offers_coins.sql · coupon use and coins reservations · verified@2026-10-23
tests/menu-schema-compat.test.cjs · missing catalog and permission regression tests · verified@2026-10-23
next.config.mjs · NEXT_BUILD_DIR selects build output; default dev .next-dev · verified@2026-10-23
src/app/loading.tsx · shared navigation skeleton, outlet/store boundaries reuse it · verified@2026-10-23

src/lib/geolocation.ts · bounded GPS retry, validation, permission/HTTPS messages, abort · verified@2026-10-24
tests/geolocation.test.cjs · 11 GPS success/error/cancel regression cases · verified@2026-10-24
src/components/modals/AddressModal.tsx · mobile GPS feedback and stale zone-request cancellation · verified@2026-10-24
