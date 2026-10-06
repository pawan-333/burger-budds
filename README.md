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

Merchant access requires email/password login and outlet staff membership. Public merchant access is disabled. Each store merchant receives the manager role, scoped to its assigned outlet. Migration 005's public-merchant RPC remains callable only by the server service role.

The owner email configured by migration 002 is `pavankotiya142@gmail.com`. Owner access is assigned on account creation when staff authentication is restored. Customer order totals are computed on the server, and database writes use atomic functions. Online payments, wallet spending, email OTP, and phone OTP are paused for this COD launch.

### Store merchant accounts

Apply migration `006_store_merchants.sql` before provisioning the accounts:

- `vinaynagar@burgerbudds.in`: Vinay Nagar
- `badagaon@burgerbudds.in`: Badagaon

The Badagaon outlet starts closed with delivery disabled. Configure its approved menu, hours, phone and delivery settings before opening it.

To create each account, load the Supabase server environment privately and set `MERCHANT_PASSWORD` to your chosen password (at least 12 characters). Run `node scripts/create-store-merchant.cjs <store-email>` separately for each store, then remove `MERCHANT_PASSWORD` from the environment. The script marks the account as administrator-provisioned; migration 006 assigns its store automatically. Public email signup cannot assign merchant membership. No passwords are stored in source code. Existing accounts are not overwritten by the script; an administrator must mark approved existing accounts with app metadata `store_merchant: true`.

Sign in at `/merchant`. Account creation and migration must be performed against the actual Supabase project; local source changes alone do not provision live accounts.

### Super admin

Apply migration `007_super_admin.sql` after 006. Load the private Supabase server environment, set your chosen `MERCHANT_PASSWORD` (12+ characters), run `node scripts/create-super-admin.cjs`, and clear the password environment variable. This provisions `admin@burgerbudds.in`; existing account passwords remain unchanged. Login at `/admin` or `/merchant` (the main account redirects to `/admin`). Super admin can add stores, archive/restore stores, open each store dashboard, create merchant accounts with chosen passwords, assign manager/staff access, and revoke memberships. Archived stores are hidden from the locator and cannot accept new orders. Order history remains available in the database. Revoking access removes the store membership, not the underlying customer account. Store merchants cannot access the admin API. Owner privileges now depend on the dedicated `super_admins` table instead of a store role.

### Badagaon online ordering

Apply `008_activate_badagaon.sql` after migrations 006 and 007. It copies the existing Vinay Nagar menu, variants and add-ons into independent Badagaon records without overwriting an existing Badagaon menu, then enables online ordering and delivery. Store cards show live outlet status. Unknown Badagaon hours and phone are not invented. Local preview includes Badagaon ordering; Supabase-backed production requires migration 008. Checkout retains the selected store and clears the cart when switching stores.
