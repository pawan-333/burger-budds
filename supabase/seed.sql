-- Burger Budds Seed Data: 1 Outlet (Vinay Nagar, Gwalior), 5 Categories, 10 Demo Burger Items, Variants, Add-ons, Coupons, Riders

-- 1. Outlet: Burger Budds - Vinay Nagar, Gwalior
insert into outlets (
  id, slug, name, address, area, lat, lng, phone, is_open, prep_time_min,
  delivery_radius_km, min_order, gst_percent, platform_fee, delivery_fee_rules, timings
) values (
  '11111111-1111-1111-1111-111111111101',
  'burger-budds-vinay-nagar-gwalior',
  'Burger Budds — Vinay Nagar, Gwalior',
  'Plot 14, Sector 3, Main Road, Vinay Nagar, Gwalior, Madhya Pradesh 474012',
  'Vinay Nagar, Gwalior',
  26.2183,
  78.1828,
  '+91 98260 12345',
  true,
  35,
  5.0,
  99.00,
  5.00,
  9.00,
  '{"base_fee": 29, "free_above": 299, "per_km_above_3km": 8}'::jsonb,
  '{"open": "11:00", "close": "23:30"}'::jsonb
) on conflict (slug) do nothing;

-- 2. 5 Categories
insert into categories (id, outlet_id, name, sort_order, is_active) values
  ('22222222-2222-2222-2222-222222222201', '11111111-1111-1111-1111-111111111101', 'Flat 129 Combos & Deals', 1, true),
  ('22222222-2222-2222-2222-222222222202', '11111111-1111-1111-1111-111111111101', 'Signature Smash Burgers', 2, true),
  ('22222222-2222-2222-2222-222222222203', '11111111-1111-1111-1111-111111111101', 'Crispy Veg & Paneer Burgers', 3, true),
  ('22222222-2222-2222-2222-222222222204', '11111111-1111-1111-1111-111111111101', 'Loaded Fries & Sides', 4, true),
  ('22222222-2222-2222-2222-222222222205', '11111111-1111-1111-1111-111111111101', 'Thick Shakes & Beverages', 5, true)
on conflict (id) do nothing;

-- 3. 10 Demo Burger & Side Items
insert into items (
  id, outlet_id, category_id, name, description, price, original_price,
  image_url, diet, is_available, is_bestseller, is_new, is_on_offer, rating, order_count, sort_order
) values
  (
    '33333333-3333-3333-3333-333333333301',
    '11111111-1111-1111-1111-111111111101',
    '22222222-2222-2222-2222-222222222201',
    'Buddy Value Burger + Peri Peri Fries Combo',
    'Our signature crispy herb-spiced patty burger served with medium peri-peri crinkle fries and chilled cola (250ml). Perfect solo meal deal!',
    179.00,
    229.00,
    'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=800&q=80',
    'veg',
    true,
    true,
    false,
    true,
    4.70,
    420,
    1
  ),
  (
    '33333333-3333-3333-3333-333333333302',
    '11111111-1111-1111-1111-111111111101',
    '22222222-2222-2222-2222-222222222201',
    'Double Trouble Chicken Smash Meal',
    'Flame-seared juicy chicken smash burger paired with 4pc crispy chicken strips and smoky chipotle dip. Eligible for FLAT129 deal.',
    249.00,
    299.00,
    'https://images.unsplash.com/photo-1586190848861-99aa4a171e90?auto=format&fit=crop&w=800&q=80',
    'nonveg',
    true,
    true,
    false,
    true,
    4.80,
    385,
    2
  ),
  (
    '33333333-3333-3333-3333-333333333303',
    '11111111-1111-1111-1111-111111111101',
    '22222222-2222-2222-2222-222222222202',
    'OG Double Cheese Chicken Smash Burger',
    'Two caramelized smashed chicken patties layered with double melted cheddar, tangy house dill pickles, charred onions, and secret Budds sauce on a toasted brioche bun.',
    229.00,
    null,
    'https://images.unsplash.com/photo-1553979459-d2229ba7433b?auto=format&fit=crop&w=800&q=80',
    'nonveg',
    true,
    true,
    false,
    false,
    4.90,
    510,
    3
  ),
  (
    '33333333-3333-3333-3333-333333333304',
    '11111111-1111-1111-1111-111111111101',
    '22222222-2222-2222-2222-222222222202',
    'Fiery Nashville Hot Chicken Burger',
    'Buttermilk-brined crispy chicken thigh glazed in fiery cayenne chili oil, topped with creamy slaw, jalapenos, and aged cheddar slice.',
    219.00,
    249.00,
    'https://images.unsplash.com/photo-1606755962773-d324e0a13086?auto=format&fit=crop&w=800&q=80',
    'nonveg',
    true,
    false,
    true,
    true,
    4.60,
    260,
    4
  ),
  (
    '33333333-3333-3333-3333-333333333305',
    '11111111-1111-1111-1111-111111111101',
    '22222222-2222-2222-2222-222222222202',
    'Street-Style Masala Egg & Cheese Burger',
    'Fluffy masala double egg fry with molten cheese slice, crunchy red onions, green mint chutney mayo, and toasted sesame bun.',
    139.00,
    null,
    'https://images.unsplash.com/photo-1520072959219-c595dc870360?auto=format&fit=crop&w=800&q=80',
    'egg',
    true,
    false,
    false,
    false,
    4.50,
    190,
    5
  ),
  (
    '33333333-3333-3333-3333-333333333306',
    '11111111-1111-1111-1111-111111111101',
    '22222222-2222-2222-2222-222222222203',
    'Royal Tandoori Paneer Crunch Burger',
    'Thick-cut malai paneer slab coated in crunchy panko crumbs, drizzled with smoky tandoori mayo, crisp iceberg lettuce, and pickled gherkins.',
    189.00,
    219.00,
    'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=800&q=80',
    'veg',
    true,
    true,
    false,
    true,
    4.80,
    460,
    6
  ),
  (
    '33333333-3333-3333-3333-333333333307',
    '11111111-1111-1111-1111-111111111101',
    '22222222-2222-2222-2222-222222222203',
    'Classic Crispy Aloo Tikki Buddy Burger',
    'Golden spiced potato & green pea patty topped with tangy imli-tomato glaze, fresh onion rings, and creamy herb dressing.',
    99.00,
    119.00,
    'https://images.unsplash.com/photo-1571091718767-18b5b1457add?auto=format&fit=crop&w=800&q=80',
    'veg',
    true,
    true,
    false,
    true,
    4.60,
    610,
    7
  ),
  (
    '33333333-3333-3333-3333-333333333308',
    '11111111-1111-1111-1111-111111111101',
    '22222222-2222-2222-2222-222222222203',
    'Truffle Mushroom & Swiss Melt Burger',
    'Sauteed button & shiitake mushrooms in garlic butter, melted Swiss cheese, and truffle aioli over a crispy herb-veg patty.',
    209.00,
    null,
    'https://images.unsplash.com/photo-1594212699903-ec8a3eca50f5?auto=format&fit=crop&w=800&q=80',
    'veg',
    false,
    false,
    true,
    false,
    4.40,
    95,
    8
  ),
  (
    '33333333-3333-3333-3333-333333333309',
    '11111111-1111-1111-1111-111111111101',
    '22222222-2222-2222-2222-222222222204',
    'Cheesy Jalapeno Loaded Crinkle Fries',
    'Crispy golden crinkle-cut fries smothered in warm nacho cheese sauce, pickled jalapeno slices, and smoky paprika dust.',
    149.00,
    169.00,
    'https://images.unsplash.com/photo-1576107232684-1279f3908594?auto=format&fit=crop&w=800&q=80',
    'veg',
    true,
    true,
    false,
    true,
    4.70,
    340,
    9
  ),
  (
    '33333333-3333-3333-3333-333333333310',
    '11111111-1111-1111-1111-111111111101',
    '22222222-2222-2222-2222-222222222205',
    'Belgian Chocolate Fudge Thick Shake (350ml)',
    'Rich dark Belgian chocolate blended with creamy vanilla bean ice cream, topped with chocolate drizzle and crunchy choco chips.',
    159.00,
    null,
    'https://images.unsplash.com/photo-1572490122747-3968b75cc699?auto=format&fit=crop&w=800&q=80',
    'veg',
    true,
    false,
    true,
    false,
    4.80,
    275,
    10
  )
on conflict (id) do nothing;

-- 4. Variants & Add-ons for customization
insert into item_variants (id, item_id, name, price_delta) values
  ('44444444-4444-4444-4444-444444444401', '33333333-3333-3333-3333-333333333303', 'Regular Single Smash', 0.00),
  ('44444444-4444-4444-4444-444444444402', '33333333-3333-3333-3333-333333333303', 'King Double Smash (+Extra Patty)', 60.00),
  ('44444444-4444-4444-4444-444444444403', '33333333-3333-3333-3333-333333333306', 'Regular Bun', 0.00),
  ('44444444-4444-4444-4444-444444444404', '33333333-3333-3333-3333-333333333306', 'Toasted Brioche Bun + Double Paneer', 55.00),
  ('44444444-4444-4444-4444-444444444405', '33333333-3333-3333-3333-333333333307', 'Single Patty', 0.00),
  ('44444444-4444-4444-4444-444444444406', '33333333-3333-3333-3333-333333333307', 'Double Tikki Decker', 40.00)
on conflict (id) do nothing;

insert into addon_groups (id, item_id, name, min_select, max_select) values
  ('55555555-5555-5555-5555-555555555501', '33333333-3333-3333-3333-333333333303', 'Extra Toppings & Cheese', 0, 4),
  ('55555555-5555-5555-5555-555555555502', '33333333-3333-3333-3333-333333333306', 'Extra Toppings & Cheese', 0, 4),
  ('55555555-5555-5555-5555-555555555503', '33333333-3333-3333-3333-333333333307', 'Make It a Meal / Extras', 0, 3)
on conflict (id) do nothing;

insert into addons (id, group_id, name, price, diet) values
  ('66666666-6666-6666-6666-666666666601', '55555555-5555-5555-5555-555555555501', 'Extra Cheddar Cheese Slice', 25.00, 'veg'),
  ('66666666-6666-6666-6666-666666666602', '55555555-5555-5555-5555-555555555501', 'Pickled Jalapenos & Gherkins', 20.00, 'veg'),
  ('66666666-6666-6666-6666-666666666603', '55555555-5555-5555-5555-555555555501', 'Fried Sunny-Side Egg', 30.00, 'egg'),
  ('66666666-6666-6666-6666-666666666604', '55555555-5555-5555-5555-555555555502', 'Extra Cheddar Cheese Slice', 25.00, 'veg'),
  ('66666666-6666-6666-6666-666666666605', '55555555-5555-5555-5555-555555555502', 'Peri-Peri Dip Cup', 20.00, 'veg'),
  ('66666666-6666-6666-6666-666666666606', '55555555-5555-5555-5555-555555555503', 'Extra Cheese Slice', 25.00, 'veg'),
  ('66666666-6666-6666-6666-666666666607', '55555555-5555-5555-5555-555555555503', 'Medium Salted Fries + Coke (250ml)', 89.00, 'veg')
on conflict (id) do nothing;

-- 5. Coupons
insert into coupons (id, code, title, description, type, value, min_order, max_discount, first_order_only, is_active) values
  ('77777777-7777-7777-7777-777777777701', 'FLAT129', 'ENJOY FLAT ₹70 OFF on orders above ₹199', 'Use code FLAT129 to unlock flat ₹129 effective deal savings on orders above ₹199', 'flat', 70.00, 199.00, 70.00, false, true),
  ('77777777-7777-7777-7777-777777777702', 'BUDDS50', '50% OFF up to ₹100 on your first order', 'Welcome to Burger Budds! Enjoy 50% off up to ₹100 on orders above ₹159', 'percent', 50.00, 159.00, 100.00, true, true),
  ('77777777-7777-7777-7777-777777777703', 'PARTY150', 'Flat ₹150 OFF on Party Orders above ₹599', 'Feeding the gang? Save ₹150 instantly on cart value ₹599+', 'flat', 150.00, 599.00, 150.00, false, true)
on conflict (code) do nothing;

-- 6. Demo Riders
insert into riders (id, name, phone, is_active) values
  ('88888888-8888-8888-8888-888888888801', 'Rohit Tomar', '+91 97550 11223', true),
  ('88888888-8888-8888-8888-888888888802', 'Deepak Kushwah', '+91 97550 44556', true)
on conflict (id) do nothing;
