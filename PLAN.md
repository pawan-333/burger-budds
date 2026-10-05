# Burger Budds — Online Ordering Website + Merchant App (PLAN.md)

Reference: Bikkgane Biryani ordering site (bikkganebiryani.com). Same UX flow and layout, but Burger Budds branding, own backend, own merchant app.

## 1. Goal
Ek mobile-first food delivery website jahan customer menu dekh kar order kare, address pin kare, pay kare, aur order track kare. Restaurant ke liye ek Merchant App (PWA) jo naye order pe sound + alert de, accept/reject/prepare/ready kare. Plus ek Admin panel menu, offers, delivery zone manage karne ke liye.

## 2. Tech Stack
| Layer | Choice |
|---|---|
| Frontend | Next.js (App Router) + TypeScript + Tailwind CSS |
| Backend/DB | Supabase (Postgres, Auth phone OTP, Realtime, Storage, RLS) |
| Payments | Razorpay (UPI/cards) + Cash on Delivery |
| Maps | Google Maps JS + Places API + Geocoding |
| Merchant App | PWA at `/merchant` (installable, Realtime, alarm sound, web push). Later wrap with Capacitor for APK |
| Rider | Simple page `/rider` (assigned orders, status buttons) — phase 2 |
| Hosting | Vercel + Supabase |
| Notifications | Web Push + WhatsApp order updates (phase 2) |

## 3. Brand & Design System (tokens, no raw hex in components)
Font: **Figtree** (fallback: Open Sans, Helvetica, Arial, sans-serif). Base 14px on mobile, weight 500–700.

```
color.brand.primary     = #f7ce0c   (yellow: CTAs, cart button, badges, highlights)
color.brand.secondary   = #4c6d3e   (green: header, nav, footer, veg-safe accents)
color.text.primary      = #212121
color.text.secondary    = #3a3a3a
color.text.onSecondary  = #ffffff
color.text.onPrimary    = #212121   (always dark text on yellow)
color.surface.base      = #ffffff
color.surface.raised    = #f8f8f8
color.surface.page      = #f4f1e6   (warm cream page bg)
color.border.muted      = #d2d2d2
color.border.subtle     = #e8eaed
color.status.open       = #1e9e4a
color.status.error      = #d92d20
color.veg = #0f8a3c   color.nonveg = #d92d20   color.egg = #f0a500

radius.xs=8px  radius.sm=10px  radius.md=12px  radius.pill=999px
shadow.1 = 0 2px 8px rgba(0,0,0,0.06)
space: 4 / 6 / 8 / 10 / 12 / 16 / 24
motion: instant 120ms, fast 200ms, normal 300ms
```
Contrast note: yellow text on green only for large text (≥18px bold). Body text on green must be white. Buttons on yellow use dark text.

Accessibility: WCAG 2.2 AA, keyboard-first, visible focus ring (2px, `color.text.primary` with 2px offset), min touch target 44px. Every component must define: default, hover, focus-visible, active, disabled, loading, error.

## 4. Customer Website — Pages & Components

### 4.1 Global Header
- Green (`brand.secondary`) bar. Left: logo. Center (desktop): search bar "Search this outlet's menu — N items" with mic icon (voice search via Web Speech API). Right: **Track**, **Login/Profile**, **Cart** (yellow button with count badge).
- Sub-nav row: Home, About Us, Store Locator, Order Now, Gallery.
- Mobile: hamburger (opens drawer with same links + "Order Online" outline button + "Download The App" yellow button + store phone), logo center, icons: location, profile, cart.

### 4.2 Order/Menu Page (`/order/[outlet-slug]`)
- **Left sidebar (desktop)**: "Menu" list of categories with item counts, active category highlighted, some categories expandable (+).
- **Outlet header**: outlet name, info (i) icon, green **OPEN/CLOSED** badge, area + ETA ("Vinay Nagar, Gwalior • 45 Mins"), **Order Type** dropdown (Delivery / Takeaway).
- **Offers strip**: "ENJOY FLAT 129 on every order — Use code FLAT129", "N OFFERS" dropdown listing all coupons.
- **Filter chips** (horizontal scroll): Filters, In Stock (default on, removable), Veg, Non-Veg, Egg, On Offer, Rated 4+, Highly Ordered, Bestseller, New.
- **Category section**: uppercase title + "N items" right aligned.
- **Item card**: veg/non-veg mark, name, price ₹, 2-line description + "Read more", image right with overlapping **ADD +** button. After adding it becomes a **− 1 +** stepper (yellow). Two columns on desktop, one column on mobile.
- **Item modal** (tap on card): big image, share + close buttons, veg mark, name, price, description, variants/add-ons (size, extra cheese, etc.), sticky yellow "₹269.00 | Add to Cart" bar.
- **Sticky View Cart bar**: "View Cart • 1 Item | ₹199" (desktop floating pill, mobile full-width yellow bar bottom).
- **Mobile bottom dock**: search field + black "Menu" button → opens category modal (list with counts).
- Out-of-stock items: greyed, ADD disabled, label "Unavailable".

### 4.3 Checkout (`/checkout/[cartId]`)
Sections in order:
1. **Items Added** — line items with stepper, price; buttons "Add More Items", "Add Special Instructions".
2. **Craving More?** — horizontal carousel of upsell items with + button.
3. **Savings Corner** — coupon list with Apply button (disabled + hint like "Add items worth ₹30 more to apply"), "View All Offers", wallet row "Available BB Coins: 150 — Use Wallet Balance".
4. **Delivery Details** — address + Change.
5. **Bill Details** — Item Total, GST 5%, Delivery fee, Platform fee (configurable), Discount, **Grand Total**.
6. Checkbox: "Yes, I would like to receive updates and exclusive offers from Burger Budds" (opt-in, unchecked by default is recommended).
7. Sticky CTA: "Select Delivery Address" → becomes "Pay ₹X" after address selected.
- Desktop: two columns (left items/upsell/savings, right delivery + bill + CTA). Mobile: single column, sticky bottom CTA.

### 4.4 Address Flow
- Desktop: modal "Select Delivery Address" (saved addresses list; empty state: "No saved addresses yet — Add a delivery address to check availability and see your delivery time." + **+ Add New Address**).
- **Add New Address** (2 steps on mobile, split panel on desktop):
  - Step 1: Google map with search box + "Use my location", draggable pin, tooltip "Your order will be delivered here — Move the map to place the pin".
  - Serviceability check on every pin move: if outside delivery zone show red banner "Location is not serviceable" and disable Save.
  - Step 2 "Address details": green card with auto locality/city + "Change on map"; House/Flat/Office No.* ; Landmark (optional); Phone* (+91); Email (optional); Save as: Home / Office / Hotel / Other; CTA "Save Address & Deliver Here".
- Serviceability = polygon or radius (default 5 km) around outlet, configurable in admin.

### 4.5 Auth
- Login/Sign up via phone OTP (Supabase Auth). Guests can browse and build cart; login required at checkout.

### 4.6 Profile Menu (dropdown/drawer)
Avatar + name + email, then: Personal Information, My Orders, Refer and Earn, BB Coins (wallet), Manage Addresses, FAQs, How to track my Refund?, Raise a Concern, **Logout**.

### 4.7 Order Tracking (`/track/[orderId]`)
Live status timeline via Supabase Realtime: Placed → Accepted → Preparing → Ready → Out for delivery → Delivered (or Rejected/Cancelled). Show ETA, rider name/call button, order items, bill.

### 4.8 Other pages
Home (hero banner, featured items, "Order Now" CTA), About Us, Store Locator (outlets + map + call), Gallery, FAQs, Terms, Privacy, Refund policy, Contact.

## 5. Merchant App (`/merchant`, PWA)
Login: email+password or phone OTP for staff (role: `owner`, `manager`, `staff`).

Screens:
1. **Live Orders** — tabs: New / Preparing / Ready / Completed. New order = full-screen alert + looping alarm sound until accepted (must unlock audio with first tap). Order card: order #, time, items, notes, customer name/phone, payment (Paid / COD ₹X), total.
2. **Order actions**: Accept (choose prep time 10/15/20/30 min) · Reject (reason required) · Mark Preparing · Mark Ready · Hand over to rider / Out for delivery · Delivered. Print KOT (browser print, 58/80mm CSS).
3. **Menu Manager** — toggle item In Stock/Out of Stock instantly, edit price, category-level toggle.
4. **Store Controls** — Open/Close toggle, pause orders for 30/60 min, set prep time, delivery on/off.
5. **Reports** — today/week orders, revenue, top items, cancellation rate. Export CSV.
6. **Settings** — printer, sound volume, staff users.
- Web Push + Realtime subscription so orders arrive even if screen is off; auto-reconnect indicator ("Connected / Offline").
- Unaccepted for 3 min → repeat alert; 5 min → auto-flag to owner via WhatsApp/SMS (phase 2).

## 6. Admin Panel (`/admin`, owner only)
Categories & items CRUD (image upload, veg/non-veg/egg, variants, add-ons, tags: Bestseller/New, sort order), coupons (flat/percent, min order, first-order, usage limits), banners, delivery zone + fees, tax %, outlet timings, staff users, customers, orders, refunds, reviews, BB Coins rules.

## 7. Database Schema (Supabase / Postgres)
```
outlets(id, slug, name, address, lat, lng, phone, is_open, prep_time_min, delivery_radius_km, delivery_polygon jsonb, min_order, gst_percent, platform_fee, delivery_fee_rules jsonb, timings jsonb)
categories(id, outlet_id, name, sort_order, parent_id, is_active)
items(id, outlet_id, category_id, name, description, price, image_url, diet ENUM(veg,nonveg,egg), is_available, is_bestseller, is_new, rating, order_count, sort_order)
item_variants(id, item_id, name, price_delta)
addon_groups(id, item_id, name, min_select, max_select) ; addons(id, group_id, name, price)
profiles(id uuid=auth.users.id, name, phone, email, wallet_balance, referral_code, referred_by)
addresses(id, user_id, label ENUM(home,office,hotel,other), house, landmark, phone, email, lat, lng, locality, city)
coupons(id, code, title, type, value, min_order, max_discount, first_order_only, starts_at, ends_at, usage_limit, is_active)
carts(id, user_id, outlet_id, order_type, updated_at) ; cart_items(id, cart_id, item_id, variant_id, addons jsonb, qty, note)
orders(id, order_no, user_id, outlet_id, order_type, address_snapshot jsonb, status ENUM(placed,accepted,preparing,ready,out_for_delivery,delivered,rejected,cancelled), reject_reason, item_total, tax, delivery_fee, platform_fee, discount, wallet_used, grand_total, coupon_code, payment_method ENUM(razorpay,cod), payment_status, razorpay_order_id, special_instructions, prep_time_min, rider_id, placed_at, accepted_at, delivered_at)
order_items(id, order_id, item_name, variant, addons jsonb, qty, unit_price)
order_events(id, order_id, status, actor, created_at)
wallet_transactions(id, user_id, amount, type, ref_order_id)
staff(id, user_id, outlet_id, role)  ; riders(id, name, phone, is_active)
push_subscriptions(id, staff_id, endpoint, keys jsonb)
```
- **RLS**: customers read/write only their own carts, addresses, orders; staff read/write orders of their outlet; menu tables public read, admin write.
- Realtime enabled on `orders` and `order_events`.
- Prices always recomputed server-side (Edge Function) — never trust client totals.

## 8. Key Flows / APIs (Edge Functions or Next.js route handlers)
1. `POST /api/serviceability` {lat,lng,outlet} → {serviceable, eta, fee}
2. `POST /api/cart/price` → validates items, coupon, wallet, tax, fees, returns bill
3. `POST /api/orders` → creates order (status `placed`), creates Razorpay order if online
4. `POST /api/razorpay/webhook` → verify signature, mark paid, notify merchant
5. `PATCH /api/orders/:id/status` (staff only) → status transitions validated (no skipping, reject needs reason), writes `order_events`
6. Customer tracking subscribes to `orders` row via Realtime.
- Cancel rule: customer can cancel only while `placed`. Refund via Razorpay on reject/cancel of paid orders.
- Rate limiting + OTP throttling. Idempotency key on order create.

## 9. Responsive, Content & Edge Cases
- Breakpoints: mobile <768, tablet 768–1024, desktop >1024. Mobile-first (most users will order on phone).
- Long names: clamp to 2 lines; descriptions clamp to 2 lines + "Read more".
- Empty states for: cart, addresses, orders, search results, offline network.
- Loading skeletons for menu cards; optimistic stepper updates.
- Tone: short, clear, friendly. Buttons have descriptive labels ("Add to Cart", "Select Delivery Address"), never "Submit"/"OK".
- SEO: SSR menu pages, Open Graph tags, `Restaurant` + `Menu` JSON-LD, sitemap.

## 10. Build Phases
| Phase | Scope |
|---|---|
| 1 (MVP) | Menu page, cart, checkout, address + serviceability, OTP login, COD, order create, Merchant app (live orders, accept/reject, status, stock toggle) |
| 2 | Razorpay online payment, coupons, wallet/BB Coins, order tracking page, KOT print, web push |
| 3 | Admin panel full, reports, rider page, WhatsApp notifications, refer & earn |
| 4 | Capacitor APK for merchant (and customer), reviews/ratings, loyalty |

## 11. QA Checklist
- [ ] Brand colors only via tokens; header green, CTAs yellow with dark text
- [ ] All interactive items keyboard-reachable, visible focus, 44px touch targets
- [ ] Text contrast ≥ 4.5:1 (body) / 3:1 (large)
- [ ] Menu filters (Veg/Non-Veg/Egg/In Stock/Bestseller/etc.) combine correctly
- [ ] Out-of-stock toggle in merchant app reflects on site within 2 sec
- [ ] Address outside zone blocks order; inside zone allows
- [ ] Bill totals match server calculation; coupon rules enforced server-side
- [ ] New order triggers alarm on merchant device (tab open, and installed PWA)
- [ ] Status changes update customer tracking in real time
- [ ] Payment webhook idempotent; failed payment doesn't create paid order
- [ ] RLS tested: user A cannot read user B's orders/addresses
- [ ] Lighthouse mobile: Performance ≥ 85, Accessibility ≥ 95

## 12. Environment Variables
```
NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_GOOGLE_MAPS_KEY
RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET
VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY   (web push)
```
