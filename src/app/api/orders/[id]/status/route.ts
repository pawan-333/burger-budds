import { NextRequest, NextResponse } from "next/server";
import {
  canTransitionStatus,
  getSupabaseAdminClient,
  readLocalStore,
  writeLocalStore,
} from "@/lib/server-db";
import { OrderStatus } from "@/types/database";
import { getSupabaseServerClient, getVerifiedUser } from "@/lib/supabase/server";
import { getGuestOrderHash, publicOrder } from "@/lib/guest-session";
import { PUBLIC_MERCHANT_ACCESS } from "@/lib/site-access";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const orderId = (await params).id;
    const body = await req.json();
    const nextStatus = body.status as OrderStatus;
    const actor: string = body.actor || "merchant";
    const prepTimeMin: number | undefined = body.prepTimeMin;
    const rejectReason: string | undefined = body.rejectReason;
    const sb = getSupabaseAdminClient();
    if (sb) {
      if (PUBLIC_MERCHANT_ACCESS && actor === "merchant") {
        const { data, error } = await sb.rpc("transition_public_order", {
          target_order_id: orderId, acting_user: null, next_status: nextStatus,
          preparation_minutes: prepTimeMin || 20, rejection_reason: rejectReason || null,
        });
        if (error) return NextResponse.json({ error: "Invalid order status change." }, { status: 400 });
        return NextResponse.json({ order: publicOrder(data) });
      }
      // A guest order remains owned by its cookie even if the browser also
      // has an older authenticated session.
      const guestHash = actor === "customer" && nextStatus === "cancelled"
        ? await getGuestOrderHash() : null;
      if (guestHash) {
        const { error } = await sb.rpc("cancel_guest_order", { target_order_id: orderId, session_hash: guestHash });
        if (!error) {
          const { data: fullOrder, error: loadError } = await sb.from("orders").select("*, items:order_items(*), events:order_events(*)").eq("id", orderId).single();
          if (loadError) return NextResponse.json({ error: "Order cancelled. Please refresh to see its status." }, { status: 500 });
          return NextResponse.json({ order: publicOrder(fullOrder) });
        }
      }
      const user = await getVerifiedUser();
      if (!user) {
        if (!guestHash || nextStatus !== "cancelled") return NextResponse.json({ error: "Order status change is not allowed." }, { status: 403 });
        return NextResponse.json({ error: "Order can only be cancelled before the restaurant accepts it, from the browser that placed it." }, { status: 400 });
      }
      const session = (await getSupabaseServerClient())!;
      const { data: visible } = await session.from("orders").select("id").eq("id", orderId).maybeSingle();
      if (!visible) return NextResponse.json({ error: "Order not found" }, { status: 404 });
      const { data, error } = await sb.rpc("transition_order", {
        target_order_id: visible.id, acting_user: user.id, next_status: nextStatus,
        preparation_minutes: prepTimeMin || 20, rejection_reason: rejectReason || null,
      });
      if (error) return NextResponse.json({ error: "Order status change was not allowed. Please refresh and try again." }, { status: 400 });
      return NextResponse.json({ order: publicOrder(data) });
    }
    if (process.env.NODE_ENV === "production") return NextResponse.json({ error: "Ordering service is not configured." }, { status: 503 });

    if (!nextStatus) {
      return NextResponse.json(
        { error: "Target status is required" },
        { status: 400 }
      );
    }

    if (nextStatus === "rejected" && (!rejectReason || !rejectReason.trim())) {
      return NextResponse.json(
        { error: "A rejection reason is required when rejecting an order." },
        { status: 400 }
      );
    }

    const store = readLocalStore();
    const idx = store.orders.findIndex(
      (o) => o.id === orderId || o.order_no === orderId
    );
    if (idx === -1) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const order = store.orders[idx];

    // Customer can only cancel while 'placed'
    if (actor === "customer" && nextStatus === "cancelled") {
      if (order.status !== "placed") {
        return NextResponse.json(
          {
            error:
              "Order can only be cancelled before the restaurant accepts it.",
          },
          { status: 400 }
        );
      }
    } else if (!canTransitionStatus(order.status, nextStatus)) {
      return NextResponse.json(
        {
          error: `Invalid status transition from "${order.status}" to "${nextStatus}".`,
        },
        { status: 400 }
      );
    }

    const nowIso = new Date().toISOString();
    order.status = nextStatus;

    if (nextStatus === "accepted") {
      order.accepted_at = nowIso;
      if (typeof prepTimeMin === "number" && prepTimeMin > 0) {
        order.prep_time_min = prepTimeMin;
      }
    }

    if (nextStatus === "rejected" && rejectReason) {
      order.reject_reason = rejectReason.trim();
    }

    if (nextStatus === "delivered") {
      order.delivered_at = nowIso;
      order.payment_status = "paid";
    }

    order.events.push({
      id: `ev-${Date.now()}`,
      order_id: order.id,
      status: nextStatus,
      actor,
      note:
        nextStatus === "accepted"
          ? `Accepted (Prep time: ${order.prep_time_min} mins)`
          : nextStatus === "rejected"
          ? `Rejected: ${order.reject_reason}`
          : undefined,
      created_at: nowIso,
    });

    store.orders[idx] = order;
    writeLocalStore(store);

    return NextResponse.json({ order });
  } catch (err) {
    console.error("Order status PATCH error:", err);
    return NextResponse.json(
      { error: "Failed to update order status" },
      { status: 500 }
    );
  }
}
