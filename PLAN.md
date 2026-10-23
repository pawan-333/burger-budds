# Burger Budds Multi-Outlet Platform: Plan and Codex Tasks

Yeh file Codex ko do. Ek baar mein ek phase dena (Section 6 dekho).

---

## 1. Context

Burger Budds ek restaurant brand hai (Gwalior). Website `burgerbudds.in` ek **franchise / multi-outlet online ordering platform** hai: ek brand, kai outlets, ek central system.

- Har outlet ka page: `/order/<outlet-slug>` (jaise `burger-budds-badagaon-gwalior`, `burger-budds-vinay-nagar-gwalior`)
- Customer delivery ya takeaway le sakta hai, cart/checkout, order tracking (`/track`), BB Coins loyalty
- Restaurant ke liye Merchant App (`/merchant`) jahan orders receive hote hain
- Brand colors: yellow `#f7ce0c`, green `#4c6d3e`
- Backend preference: Supabase
- Design reference: Bikkgane Biryani ordering site (sirf flow/features inspire hone hain, copy nahi)
- Payments: **Cashfree** (Razorpay nahi)
- **ON HOLD (abhi mat banao):** Petpooja POS integration aur Rapido riders integration. Sirf data model mein future-ready placeholder rakho.

## 2. Rules for Codex

1. Sabse pehle existing codebase inspect karo aur **existing stack, folder structure aur design system follow karo**. Naya framework mat lao.
2. Koi bhi outlet-specific cheez (naam, address, phone, timing, zone, FSSAI, delivery time) **hardcode mat karo**. Sab current outlet ke record se aani chahiye.
3. Har phase ke baad: kya badla, kaun si files, aur kaise test kiya, short summary do.
4. Database changes migrations ke through karo. Purana data na toote.
5. Jahan decision chahiye wahan assumption likho, phir aage badho.
6. Bikkgane ka naam, images, text, logo ya design copy mat karo.

## 3. Live site audit: jo issues mile

Page `/order/burger-budds-badagaon-gwalior` check karne par:

- Badagaon page par address popup mein "Delivering from Burger Budds, Vinay Nagar (5 km zone)" dikhta hai. Outlet data leak.
- Header logo link `vinay-nagar` outlet par jata hai, current outlet ya home par nahi.
- Banner "ENJOY FLAT 129" aur neeche "Save flat 70 on orders above 199" match nahi karte.
- Canonical URL `https://www.burgerbudds.in` (home) hai, outlet page ka apna nahi.
- Phone `+91 98260 12345` dummy lagta hai.
- FSSAI number ek hi dikh raha hai, outlet-wise nahi.
- Filters mein Veg / Non-Veg / Egg hai par poora menu veg hai, aur item par veg/non-veg icon nahi.
- Almost har category ke sab items ki image same stock photo hai (Pexels/Unsplash).
- Descriptions generic hain. Naam inconsistency: "Capsicano", "Chilly Cheese Garlic Bread".
- "Rated 4+", "Highly Ordered", "Bestseller", "New" filters ka data items par nahi dikhta.
- Desserts mein sirf 1 item. Combos / Bestseller category missing.
- Fries ke Small/Large variants hain par base price "from" nahi dikhata.
- Login sirf email OTP. Privacy, Terms, Refund pages visible nahi.
- `/merchant` public link se accessible hai.

---

## 4. Phases aur tasks

### Phase 0: Data model (pehle yeh)

- **T0.1** Outlet model banao/audit karo. Fields: id, slug, name, address, city, lat/lng, phone, whatsapp, opening hours (day-wise), is_open override, delivery radius ya polygon, min order, delivery fee, packaging fee, avg prep/delivery time, FSSAI number, GST number, owner_type (brand / franchise), franchisee_id, status (active/paused).
- **T0.2** Menu model: central `menu_items` (brand-level) + `outlet_menu_items` (outlet_id, item_id, available, price_override, sort_order). Variants/add-ons bhi isi tarah.
- **T0.3** Roles: `brand_admin`, `franchise_owner`, `outlet_manager`, `staff`. Row Level Security (Supabase RLS) outlet-wise lagao.

**Acceptance:** Migrations chalein, seed data mein Badagaon aur Vinay Nagar dono outlets hon, aur dono ka alag data page par dikhe.

### Phase 1: Outlet data leak fix

- **T1.1** Outlet page ka header, address popup, delivery zone text, phone, timing, delivery time sab current outlet record se render karo.
- **T1.2** Logo link brand home par ya current outlet par jaye. Outlet change karne ka clear option ("Change outlet") do.
- **T1.3** Phone: dummy hatao, outlet ka phone dikhao, aur brand-level support number alag rakho.
- **T1.4** FSSAI number outlet record se footer mein dikhao.
- **T1.5** Open/Closed status timing se auto calculate ho, closing time bhi dikhe. Manager manual pause kar sake.

**Acceptance:** Badagaon page par kahin bhi "Vinay Nagar" na dikhe aur ulta bhi. Har outlet page par uska hi data ho.

### Phase 2: Security aur roles

- **T2.1** `/merchant` ko login ke peeche karo (role-based). Bina login ke redirect.
- **T2.2** Outlet manager sirf apne outlet ke orders, menu stock aur timing dekhe/badle. Franchise owner apne outlets ka data dekhe. Brand admin sab dekhe.
- **T2.3** API/DB level par outlet isolation test karo (ek outlet ka user dusre ka data na padh sake).
- **T2.4** Basic hardening: OTP par rate limiting, input validation, secrets env mein.

### Phase 3: Outlet-wise menu control

- **T3.1** Merchant app mein item ON/OFF (stock), aur permitted ho to price override.
- **T3.2** Customer site sirf us outlet ke available items dikhaye. Out-of-stock item greyed out ho.
- **T3.3** Brand admin central menu edit kare aur "publish to all / selected outlets" kar sake.
- **T3.4** Variants (Small/Large, Veg/Paneer) ke liye "from price" dikhao. Pizza ke liye size options ka structure ready rakho (abhi sirf 8 inch).

### Phase 4: Location routing aur Store Locator

- **T4.1** Customer address daale (ya GPS) to nearest serviceable outlet auto select ho.
- **T4.2** Delivery zone ke bahar ho to clear message aur takeaway ka option.
- **T4.3** Store Locator page: map, address, timing, open/closed badge, "Order from this outlet" button.
- **T4.4** Delivery time aur fee address distance se calculate ho.

### Phase 5: Offers aur BB Coins

- **T5.1** Offer system: brand-level aur outlet-level coupons, min order, validity, usage limit.
- **T5.2** Banner text coupon ke asli rule se auto generate ho (FLAT129 vs flat 70 mismatch khatam).
- **T5.3** BB Coins rule: earn aur redeem rules config se ho. Default: brand-wide shared coins (Pawan confirm kare).

### Phase 6: Brand admin panel

- **T6.1** Outlet add/edit/pause, franchisee assign.
- **T6.2** Outlet-wise reports: orders, revenue, AOV, top items, cancellations, date filter, CSV export.
- **T6.3** Central offers, banners aur menu publish.
- **T6.4** Audit log (kisne kya badla).

### Phase 7: Payments aur settlement

- **T7.1** Online payment gateway integration (**Cashfree**: order create, checkout, webhook signature verification, refunds API).
- **T7.2** Order ke saath outlet_id aur payment record store ho taaki outlet-wise settlement nikal sake.
- **T7.3** Settlement model decide karna hai (Section 5). Uske hisaab se Cashfree split/vendor settlement ya brand-collect + manual payout.
- **T7.4** Refund/cancellation flow.

### Phase 8: Menu content aur UI quality

- **T8.1** Veg/non-veg icon (green/red dot) har item par. Agar non-veg items nahi hain to Non-Veg/Egg filter hatao.
- **T8.2** Alag image slot har item ke liye (upload via admin). Tab tak ek branded fallback image, stock repeat nahi.
- **T8.3** Item names/descriptions cleanup: typos (Capsicano, Chilly to Chilli) aur behtar descriptions. Pawan content dega, Codex structure ready kare.
- **T8.4** Categories: Combos aur Bestsellers top par. Category counts aur "83 Items" count real data se aayein.
- **T8.5** Filters (Rated 4+, Highly Ordered, Bestseller, New) real data/flags se jodo ya hata do.
- **T8.6** Mobile-first check: sticky cart bar, fast add-to-cart, category chips.

### Phase 9: SEO, legal aur performance

- **T9.1** Har outlet page ka unique title, meta description, canonical (apna URL), OG tags.
- **T9.2** JSON-LD schema: `Restaurant`/`LocalBusiness`, `Menu`, opening hours, address, geo.
- **T9.3** `sitemap.xml` (saare outlet pages) aur `robots.txt`.
- **T9.4** Privacy Policy, Terms, Refund/Cancellation, Contact pages aur footer links.
- **T9.5** Login mein mobile number + OTP (SMS/WhatsApp) add karo. Email optional.
- **T9.6** Images WebP/compressed, lazy load, alt text. Lighthouse mobile 85+ target.

### Phase 10: Integrations (ON HOLD, abhi skip karo)

Petpooja aur Rapido dono abhi hold par hain. Is phase mein koi code mat likho. Sirf outlet record mein optional fields (`petpooja_restaurant_id`, `rapido_config`) aur integration on/off toggle ka placeholder rakho. Neeche ke tasks future reference ke liye hain.

- **T10.1 Petpooja (HOLD):** Har outlet ka apna Petpooja restaurant ID/credentials map ho. Order push, menu sync aur stock sync. Failure par retry aur error log.
- **T10.2 Rapido (HOLD):** Delivery order par rider assign/track, outlet pickup address ke saath. Status updates customer `/track` par dikhein.
- **T10.3 (HOLD)** Integration config outlet-wise on/off ho sake.

### Phase 11: QA aur launch

- **T11.1** End-to-end test har outlet par: browse, cart, coupon, payment, order merchant app mein aaye, status updates, tracking, coins. (Petpooja/Rapido test abhi nahi.)
- **T11.2** Outlet isolation, zone-bahar order, closed outlet order, aur coupon edge cases test.
- **T11.3** Production checklist: env vars, backups, error monitoring, analytics.

### Phase 12: Reference parity (Bikkgane Biryani jaisa flow)

Reference: `bikkganebiryani.com/order/bikkgane-biryani-kailash-vihar-gwalior` (uEngage par bana). **Sirf flow aur features inspire hone hain. Unka naam, images, text, logo ya design copy nahi karna.** Design Burger Budds ka apna rahe (yellow `#f7ce0c`, green `#4c6d3e`).

Order: T12.1 aur T12.2 ko Phase 4 ke saath, T12.3 aur T12.12 ko Phase 9 ke saath, baaki ko Phase 8 ke baad karo.

- **T12.1 Store-finding flow:** Landing par "Find a store near you" screen: Use current location, pincode/locality search, ya saved address (login ke baad). Nearest serviceable outlet auto-select ho, 3 second countdown ke baad uske menu par redirect. Koi outlet serviceable na ho to "No outlet found" aur "Explore Menu" button.
- **T12.2 Address flow (2 step):** Step 1 map par pin lagao (Use my location option). Step 2 House/Flat/Office No. (required), Landmark (optional), Phone (required), Email (optional). "Save as" Home / Office / Hotel / Other. "Order for someone else" option. Saved addresses manage karne ka page.
- **T12.3 Login upgrade:** Mobile number + OTP primary (resend timer 30 sec), WhatsApp login, Truecaller login (agar possible ho). Captcha/security check, rate limit. Terms aur Privacy checkbox. Line: "We never share your number. Used only for order updates." Email optional.
- **T12.4 Order types:** Delivery, Pickup abhi chalein. Dine In (table QR), In-Car, Reservation, Direct Pay (bill pay) ke liye data model aur UI placeholders banao, outlet-wise on/off toggle ke saath. Pehle phase mein sirf Delivery + Pickup live karo.
- **T12.5 Outlet info panel:** Outlet name, OPEN/CLOSED badge, timings (Opens at / Closes at), available order types, approx delivery time, full address, **Get Directions** (Google Maps link), FSSAI number. CLOSED hone par bhi menu dikhe aur opening time clearly likha ho.
- **T12.6 Menu discovery:** Search bar, Popular searches, Popular menu. Sort: Price low-high, Price high-low, Rating high-low. Filters: Veg / Non-Veg, On Offer, Rated 4+, In Stock, Tags. Reset aur Apply buttons. Sticky "View Cart: N items | amount" bar. Filters real data se chalein.
- **T12.7 Account menu:** Personal Information, My Orders (past orders), Refer and Earn, Wallet (BB Coins balance), Manage Addresses, FAQs, Track my Refund, Raise a Concern, Logout. Coins redeem par note: "Final redemption happens after payment."
- **T12.8 Profile completion:** First login par Full Name (required), Email, Gender, Date of Birth, Anniversary (sab optional) with "Add these to unlock birthday & anniversary treats." Birthday/anniversary coupon trigger bhi banao.
- **T12.9 Help & Support:** Topic-wise support popup (order issue, payment, refund, other) aur ticket/concern raise karna. Admin panel mein ticket list.
- **T12.10 Extra pages:** Bulk Order (form: name, phone, date, quantity, requirement), Gallery, About Us, FAQs, `/tnc`, `/privacy-policy`, `/refund-policy`. Nav: Home, About Us, Store Locator, Order Now, Gallery, Bulk Order. "Download The App" link jab app ho.
- **T12.11 Refer and Earn:** Referral code/link, referrer aur referee dono ko BB Coins, abuse rules (ek phone ek account, min order).
- **T12.12 SEO per outlet:** Title pattern "Burger Budds <Outlet>, <City> Online Ordering", unique meta description, canonical (apna URL), `meta-robots: index, follow`, `theme-color` (#f7ce0c), OG image brand logo se.

**Acceptance:** Naya user landing se location daale, nearest outlet khule, address pin karke save kare, mobile OTP se login kare, order kare aur My Orders / Wallet / Refer and Earn dekh sake. Poore flow mein kahin bhi kisi outlet ka data dusre outlet par na dikhe.

---

## 5. Open decisions (Pawan ko confirm karna hai)

1. **Paisa kaun collect karega:** brand (phir franchisee ko payout) ya direct franchisee? Royalty/commission kitna aur kaise?
2. **BB Coins:** sab outlets par chalein ya outlet-wise?
3. **Menu prices:** sab outlets par same ya outlet override allowed?
4. **Offers:** kaun bana sakta hai, sirf brand ya franchisee bhi?
5. **Delivery:** zone radius-based ya polygon? Delivery fee fixed ya distance-based?
6. **Non-veg items** menu mein aayenge ya brand pure veg rahega?

## 6. Codex ko dene ka tarika

1. Pehle Sections 1, 2 aur Phase 0 do.
2. Phase 0 pass hone ke baad ek ek phase alag prompt mein do, har baar Section 1-2 ka short context ke saath.
3. Order: Phase 1, 2, 3, phir 4 (+ T12.1, T12.2), phir 9 (+ T12.3, T12.12), phir 5, 6, 7, 8, baaki Phase 12, phir 11. Phase 10 hold par hai, skip karo.
4. Phase 1 aur 2 sabse pehle zaroori hain kyunki wahan live bugs aur security gap hain.
