import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getGuestOrderHash, publicOrder } from "@/lib/guest-session";
import { PUBLIC_MERCHANT_ACCESS } from "@/lib/site-access";
import { getSupabaseServerClient, getVerifiedUser } from "@/lib/supabase/server";
import {
  computeDistanceKm,
  getInitialStore,
  getMenuBundle,
  getSupabaseAdminClient,
  isPointInPolygon,
  readLocalStore,
  writeLocalStore,
} from "@/lib/server-db";
import { computeServerBill, ServerCartItemInput } from "@/lib/pricing";
import {
  Address,
  OrderItemRecord,
  OrderRecord,
  OrderType,
  PaymentMethod,
} from "@/types/database";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const orderId = req.nextUrl.searchParams.get("id");
  const userId = req.nextUrl.searchParams.get("userId");
  const session = await getSupabaseServerClient();
  if (session) {
    if (PUBLIC_MERCHANT_ACCESS && req.nextUrl.searchParams.get("merchant") === "1") {
      const { data, error } = await getSupabaseAdminClient()!.from("orders").select("*, items:order_items(*), events:order_events(*)").order("placed_at", { ascending: false });
      if (error) return NextResponse.json({ error: "Unable to load orders." }, { status: 500 });
      return NextResponse.json({ orders: (data || []).map(publicOrder) });
    }
    const user = await getVerifiedUser();
    if (req.nextUrl.searchParams.get("merchant") === "1") {
      if (!user) return NextResponse.json({ error: "Please log in." }, { status: 401 });
      const slug = req.nextUrl.searchParams.get("outlet");
      if (!slug) return NextResponse.json({ error: "Store is required." }, { status: 400 });
      const { data: outlet } = await session.from("outlets").select("id").eq("slug", slug).eq("is_active", true).maybeSingle();
      if (!outlet) return NextResponse.json({ error: "Store not found." }, { status: 404 });
      const { data: membership } = await session.from("staff").select("outlet_id").eq("user_id", user.id).eq("outlet_id", outlet.id).maybeSingle();
      const { data: admin } = await session.from("super_admins").select("user_id").eq("user_id", user.id).maybeSingle();
      if (!membership && !admin) return NextResponse.json({ error: "Store staff access required." }, { status: 403 });
      const { data, error } = await session.from("orders").select("*, items:order_items(*), events:order_events(*)").eq("outlet_id", outlet.id).order("placed_at", { ascending: false });
      if (error) return NextResponse.json({ error: "Unable to load orders." }, { status: 500 });
      return NextResponse.json({ orders: (data || []).map(publicOrder) });
    }
    const guestHash = !user ? await getGuestOrderHash() : null;
    if (!user && !guestHash) return orderId ? NextResponse.json({ error: "Order not found" }, { status: 404 }) : NextResponse.json({ orders: [] });
    let query = (user ? session : getSupabaseAdminClient()!).from("orders").select("*, items:order_items(*), events:order_events(*)").order("placed_at", { ascending: false });
    if (!user) query = query.eq("guest_session_hash", guestHash);
    if (orderId) {
      if (orderId.startsWith("BB-")) query = query.eq("order_no", orderId);
      else query = query.eq("id", orderId);
    }
    if (userId && user) query = query.eq("user_id", user.id);
    const { data, error } = await query;
    if (error) return NextResponse.json({ error: "Unable to load orders." }, { status: 500 });
    if (orderId) return data?.[0]
      ? NextResponse.json({ order: publicOrder(data[0]) })
      : NextResponse.json({ error: "Order not found" }, { status: 404 });
    return NextResponse.json({ orders: (data || []).map(publicOrder) });
  }
  if (process.env.NODE_ENV === "production") return NextResponse.json({ error: "Ordering service is not configured." }, { status: 503 });
  const store = readLocalStore();

  if (orderId) {
    const found = store.orders.find(
      (o) => o.id === orderId || o.order_no === orderId
    );
    if (!found) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    return NextResponse.json({ order: found });
  }

  let orders = [...store.orders].sort(
    (a, b) => new Date(b.placed_at).getTime() - new Date(a.placed_at).getTime()
  );

  if (userId) {
    orders = orders.filter((o) => o.user_id === userId);
  }

  return NextResponse.json({ orders });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (body.paymentMethod === "razorpay") {
      return NextResponse.json(
        { error: "Online payment is not available yet. Please choose Cash on Delivery." },
        { status: 400 }
      );
    }
    const idempotencyKey: string | undefined = body.idempotencyKey;
    const sb = getSupabaseAdminClient();
    const verifiedUser = sb ? await getVerifiedUser() : null;
    const guestHash = sb && !verifiedUser ? await getGuestOrderHash(true) : null;
    if (!sb && process.env.NODE_ENV === "production") return NextResponse.json({ error: "Ordering service is not configured." }, { status: 503 });
    if (idempotencyKey && (typeof idempotencyKey !== "string" || idempotencyKey.length > 200)) return NextResponse.json({ error: "Invalid order request key." }, { status: 400 });
    const store = sb ? { ...getInitialStore(), orders: [], idempotencyKeys: {} as Record<string, string> } : readLocalStore();

    if (idempotencyKey && store.idempotencyKeys[idempotencyKey]) {
      const existingOrderId = store.idempotencyKeys[idempotencyKey];
      const existingOrder = store.orders.find((o) => o.id === existingOrderId);
      if (existingOrder) {
        return NextResponse.json({ order: existingOrder, duplicate: true });
      }
    }

    const { outlet, items: menuItems, coupons } = await getMenuBundle(
      body.outletSlug
    );

    if (!outlet.is_open) {
      return NextResponse.json(
        {
          error:
            "This Burger Budds outlet is currently closed and not accepting new orders.",
        },
        { status: 400 }
      );
    }

    const orderType: OrderType =
      body.orderType === "takeaway" ? "takeaway" : "delivery";
    const address: Address | null = body.address || null;
    if (orderType === "takeaway" && !/^[6-9]\d{9}$/.test(String(body.customerPhone || "").replace(/\D/g, "").slice(-10))) {
      return NextResponse.json({ error: "Please enter a valid pickup mobile number." }, { status: 400 });
    }

    let distanceKm = 1.5;
    if (orderType === "delivery") {
      if (!address || !Number.isFinite(address.lat) || !Number.isFinite(address.lng) || address.lat < -90 || address.lat > 90 || address.lng < -180 || address.lng > 180 || !address.house?.trim() || !/^[6-9]\d{9}$/.test(address.phone?.replace(/\D/g, "").slice(-10) || "")) {
        return NextResponse.json(
          { error: "Please select a valid delivery address." },
          { status: 400 }
        );
      }

      distanceKm = computeDistanceKm(
        outlet.lat,
        outlet.lng,
        address.lat,
        address.lng
      );

      let serviceable = distanceKm <= (outlet.delivery_radius_km || 5.0);
      if (outlet.delivery_polygon && outlet.delivery_polygon.length >= 3) {
        serviceable = isPointInPolygon(
          address.lat,
          address.lng,
          outlet.delivery_polygon
        );
      }
      if (!serviceable || outlet.delivery_enabled === false) {
        return NextResponse.json(
          {
            error:
              `Location is not serviceable. Please choose an address within ${outlet.delivery_radius_km} km of ${outlet.name}.`,
          },
          { status: 400 }
        );
      }
    }

    const rawLines: Array<{
      itemId: string;
      variantId?: string | null;
      addonIds?: string[];
      qty: number;
    }> = Array.isArray(body.items) ? body.items : [];

    if (rawLines.length === 0) {
      return NextResponse.json(
        { error: "Your cart is empty." },
        { status: 400 }
      );
    }
    if (rawLines.length > 100 || rawLines.some((line) => !Number.isInteger(line.qty) || line.qty < 1 || line.qty > 50 || typeof line.itemId !== "string" || (line.addonIds && !Array.isArray(line.addonIds)))) {
      return NextResponse.json({ error: "Please check your cart quantities." }, { status: 400 });
    }
    if (body.useWallet) return NextResponse.json({ error: "Wallet payments are not available yet." }, { status: 400 });

    const serverInput: ServerCartItemInput[] = rawLines.map((l) => ({
      itemId: l.itemId,
      variantId: l.variantId || null,
      addonIds: l.addonIds || [],
      qty: Number(l.qty) || 1,
    }));

    const bill = computeServerBill({
      cartItems: serverInput,
      menuItems,
      outlet,
      coupons,
      orderType,
      couponCode: body.couponCode || null,
      useWallet: false,
      walletBalance: 0,
      distanceKm,
    });

    if (bill.unavailableItemIds.length > 0) {
      return NextResponse.json(
        {
          error:
            "One or more items in your cart just went out of stock. Please review your cart.",
          unavailableItemIds: bill.unavailableItemIds,
        },
        { status: 409 }
      );
    }
    if (bill.itemTotal < Number(outlet.min_order)) return NextResponse.json({ error: `Minimum order value is ₹${outlet.min_order}.` }, { status: 400 });

    const orderId = sb ? randomUUID() : `ord-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const nextNumber = 2402 + store.orders.length;
    const orderNo = sb ? `BB-${Date.now()}-${randomUUID().slice(0, 8).toUpperCase()}` : `BB-${nextNumber}`;
    const nowIso = new Date().toISOString();

    const orderItems: OrderItemRecord[] = rawLines.map((line, index) => {
      const dbItem = menuItems.find((m) => m.id === line.itemId)!;
      let unitPrice = Number(dbItem.price);
      let variantName: string | null = null;

      if (line.variantId && dbItem.variants?.length) {
        const v = dbItem.variants.find((vr) => vr.id === line.variantId);
        if (v) {
          variantName = v.name;
          unitPrice += Number(v.price_delta);
        }
      }

      const selectedAddons: Array<{ id: string; name: string; price: number }> =
        [];
      if (line.addonIds?.length && dbItem.addon_groups?.length) {
        const allAddons = dbItem.addon_groups.flatMap((g) => g.addons || []);
        for (const aid of line.addonIds) {
          const found = allAddons.find((a) => a.id === aid);
          if (found) {
            selectedAddons.push({
              id: found.id,
              name: found.name,
              price: Number(found.price),
            });
            unitPrice += Number(found.price);
          }
        }
      }

      return {
        id: sb ? randomUUID() : `oi-${Date.now()}-${index}`,
        order_id: orderId,
        item_id: dbItem.id,
        item_name: dbItem.name,
        diet: dbItem.diet,
        variant: variantName,
        addons: selectedAddons,
        qty: Number(line.qty) || 1,
        unit_price: unitPrice,
      };
    });

    const paymentMethod: PaymentMethod =
      body.paymentMethod === "razorpay" ? "razorpay" : "cod";

    const newOrder: OrderRecord = {
      id: orderId,
      order_no: orderNo,
      user_id: verifiedUser?.id || (sb ? null : "guest-user"),
      customer_name: body.customerName || "Burger Budds Customer",
      customer_phone:
        verifiedUser?.phone || body.customerPhone || address?.phone || "",
      outlet_id: outlet.id,
      order_type: orderType,
      address_snapshot: address
        ? { ...address, distance_km: distanceKm }
        : null,
      status: "placed",
      reject_reason: null,
      item_total: bill.itemTotal,
      tax: bill.tax,
      delivery_fee: bill.deliveryFee,
      platform_fee: bill.platformFee,
      discount: bill.discount,
      wallet_used: bill.walletUsed,
      grand_total: bill.grandTotal,
      coupon_code: bill.couponCode,
      payment_method: paymentMethod,
      payment_status: "pending",
      razorpay_order_id: null,
      special_instructions: body.specialInstructions || "",
      marketing_opt_in: Boolean(body.marketingOptIn),
      prep_time_min: outlet.prep_time_min || 25,
      rider_id: null,
      placed_at: nowIso,
      accepted_at: null,
      delivered_at: null,
      items: orderItems,
      events: [
        {
          id: sb ? randomUUID() : `ev-${Date.now()}`,
          order_id: orderId,
          status: "placed",
          actor: "customer",
          note: `Order placed via ${paymentMethod.toUpperCase()}`,
          created_at: nowIso,
        },
      ],
    };

    if (sb) {
      const { data, error } = await sb.rpc("create_order_atomic", {
        order_payload: { ...newOrder, guest_session_hash: guestHash },
        request_key: idempotencyKey || randomUUID(),
      });
      if (error) throw error;
      return NextResponse.json({ order: publicOrder(data) }, { status: 201 });
    }
    store.orders.unshift(newOrder);
    if (idempotencyKey) {
      store.idempotencyKeys[idempotencyKey] = newOrder.id;
    }
    writeLocalStore(store);

    return NextResponse.json({ order: newOrder }, { status: 201 });
  } catch (err) {
    console.error("Create order error:", err);
    return NextResponse.json(
      { error: "Failed to place order. Please try again." },
      { status: 500 }
    );
  }
}
