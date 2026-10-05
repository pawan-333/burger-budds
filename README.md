# Burger Budds

Next.js ordering site with a Supabase database, email authentication, cash on delivery, and an outlet staff dashboard.

## Local development

Install dependencies with `npm ci`, copy `.env.example` to `.env.local`, and set the Supabase variables. Run `npm run dev` and open http://localhost:3000. Never commit `.env.local` or server keys.

Run `npm run typecheck`, `npm test`, and `npm run build` before deploying.

## Dedicated infrastructure

- GitHub: https://github.com/pawan-333/burger-budds
- Vercel project: `burger-budds` in `pawan-team1`
- Supabase project: `fyhkxqygoqmllxjfybyt`
- Intended domain: `burgerbudds.in` (GoDaddy)

Keep this application's changes scoped to these resources. Do not modify the Pawan Game Zone project, its database, deployments, or domains.

## Deployment checklist

1. Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and server-only `SUPABASE_SERVICE_ROLE_KEY` in this Vercel project. The key must belong to this dedicated Supabase project.
2. Apply the SQL migrations in order. The initial menu seed contains sample business data; replace it with approved outlet details and menu prices before accepting orders.
3. Configure custom SMTP in Supabase and email templates containing `{{ .Token }}` for email OTP. Set the production site URL and approved redirect URLs.
4. Deploy and verify email login, saved addresses, order creation, staff access, status changes, and customer isolation.
5. Add the domain in Vercel and use the exact DNS records shown there. Preserve unrelated DNS records, including mail records.
6. Open the outlet only after the above checks pass and business details are confirmed.

Customer checkout currently uses guest sessions and requests no email or OTP. Guest tracking is scoped to the browser's opaque cookie. Phone numbers and delivery details remain necessary to fulfil COD orders.

At the owner's explicit request, the live merchant dashboard is temporarily public, including order/customer details and menu/status controls. `PUBLIC_MERCHANT_ACCESS` in `src/lib/site-access.ts` controls this mode across the UI and APIs. Set it to false and redeploy to restore verified staff access. Migration 005's public-merchant RPC is callable only by the server service role.

The owner email configured by migration 002 is `pavankotiya142@gmail.com`. Owner access is assigned on account creation when staff authentication is restored. Customer order totals are computed on the server, and database writes use atomic functions. Online payments, wallet spending, email OTP, and phone OTP are paused for this COD launch.
