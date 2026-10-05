import { NextRequest, NextResponse } from "next/server";
import {
  computeDistanceKm,
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
    const store = readLocalStore();

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

    let distanceKm = 1.5;
    if (orderType === "delivery") {
      if (!address || typeof address.lat !== "number" || typeof address.lng !== "number") {
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
              "Location is not serviceable. Please choose an address within 5 km of Burger Budds Vinay Nagar.",
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
      useWallet: Boolean(body.useWallet),
      walletBalance:
        typeof body.walletBalance === "number" ? body.walletBalance : 150,
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

    const orderId = `ord-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const nextNumber = 2402 + store.orders.length;
    const orderNo = `BB-${nextNumber}`;
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
        id: `oi-${Date.now()}-${index}`,
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
      user_id: body.userId || "guest-user",
      customer_name: body.customerName || "Burger Budds Customer",
      customer_phone:
        body.customerPhone || address?.phone || "+91 98260 00000",
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
      payment_status: paymentMethod === "razorpay" ? "paid" : "pending",
      razorpay_order_id:
        paymentMethod === "razorpay" ? `rzp_live_${Date.now()}` : null,
      special_instructions: body.specialInstructions || "",
      marketing_opt_in: Boolean(body.marketingOptIn),
      prep_time_min: outlet.prep_time_min || 25,
      rider_id: "88888888-8888-8888-8888-888888888801",
      rider_name: "Rohit Tomar",
      rider_phone: "+91 97550 11223",
      placed_at: nowIso,
      accepted_at: null,
      delivered_at: null,
      items: orderItems,
      events: [
        {
          id: `ev-${Date.now()}`,
          order_id: orderId,
          status: "placed",
          actor: "customer",
          note: `Order placed via ${paymentMethod.toUpperCase()}`,
          created_at: nowIso,
        },
      ],
    };

    store.orders.unshift(newOrder);
    if (idempotencyKey) {
      store.idempotencyKeys[idempotencyKey] = newOrder.id;
    }
    writeLocalStore(store);

    const sb = getSupabaseAdminClient();
    if (sb) {
      try {
        await sb.from("orders").insert({
          order_no: newOrder.order_no,
          customer_name: newOrder.customer_name,
          customer_phone: newOrder.customer_phone,
          outlet_id: newOrder.outlet_id,
          order_type: newOrder.order_type,
          address_snapshot: newOrder.address_snapshot,
          status: newOrder.status,
          item_total: newOrder.item_total,
          tax: newOrder.tax,
          delivery_fee: newOrder.delivery_fee,
          platform_fee: newOrder.platform_fee,
          discount: newOrder.discount,
          wallet_used: newOrder.wallet_used,
          grand_total: newOrder.grand_total,
          coupon_code: newOrder.coupon_code,
          payment_method: newOrder.payment_method,
          payment_status: newOrder.payment_status,
          special_instructions: newOrder.special_instructions,
          prep_time_min: newOrder.prep_time_min,
        });
      } catch {
        // Handled gracefully if user_id is guest UUID
      }
    }

    return NextResponse.json({ order: newOrder }, { status: 201 });
  } catch (err) {
    console.error("Create order error:", err);
    return NextResponse.json(
      { error: "Failed to place order. Please try again." },
      { status: 500 }
    );
  }
}
