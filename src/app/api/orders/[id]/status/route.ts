import { NextRequest, NextResponse } from "next/server";
import {
  canTransitionStatus,
  getSupabaseAdminClient,
  readLocalStore,
  writeLocalStore,
} from "@/lib/server-db";
import { OrderStatus } from "@/types/database";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const orderId = params.id;
    const body = await req.json();
    const nextStatus = body.status as OrderStatus;
    const actor: string = body.actor || "merchant";
    const prepTimeMin: number | undefined = body.prepTimeMin;
    const rejectReason: string | undefined = body.rejectReason;

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

    const sb = getSupabaseAdminClient();
    if (sb) {
      try {
        await sb
          .from("orders")
          .update({
            status: order.status,
            prep_time_min: order.prep_time_min,
            reject_reason: order.reject_reason,
            accepted_at: order.accepted_at,
            delivered_at: order.delivered_at,
            payment_status: order.payment_status,
          })
          .eq("order_no", order.order_no);
      } catch {
        // Ignore if not in remote DB
      }
    }

    return NextResponse.json({ order });
  } catch (err) {
    console.error("Order status PATCH error:", err);
    return NextResponse.json(
      { error: "Failed to update order status" },
      { status: 500 }
    );
  }
}
