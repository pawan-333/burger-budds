import { NextRequest, NextResponse } from "next/server";
import {
  getSupabaseAdminClient,
} from "@/lib/server-db";
import { OrderStatus } from "@/types/database";
import { getSupabaseServerClient, getVerifiedUser } from "@/lib/supabase/server";
import { getGuestOrderHash, publicOrder } from "@/lib/guest-session";
import { PUBLIC_MERCHANT_ACCESS } from "@/lib/site-access";
import { parseRiderDetails, riderHandoverNote } from "@/lib/order-rider";
import { isRiderUuid, riderJson, riderRpcError } from "@/lib/rider-access";

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
    if (body.riderId !== undefined) {
      if (actor !== "merchant" || nextStatus !== "out_for_delivery" || !isRiderUuid(body.riderId) || !isRiderUuid(orderId)) {
        return riderJson({ error: "Invalid rider assignment." }, 400);
      }
      // Registered assignments never use the legacy public-merchant branch.
      if (!/^Bearer [^\s]+$/i.test(req.headers.get("authorization") || "")) return riderJson({ error: "Store sign-in required." }, 401);
      const user = await getVerifiedUser(req);
      if (!user) return riderJson({ error: "Store sign-in required." }, 401);
      const riderDb = getSupabaseAdminClient();
      if (!riderDb) return riderJson({ error: "Rider service is not configured." }, 503);
      const { data, error } = await riderDb.rpc("assign_order_rider", {
        target_order_id: orderId, acting_user: user.id, target_rider_id: body.riderId,
      });
      if (error) return riderRpcError(error);
      return riderJson({ order: publicOrder(data) });
    }
    const handingOver = actor === "merchant" && nextStatus === "out_for_delivery";
    const rider = handingOver ? parseRiderDetails(body.riderName, body.riderPhone) : null;
    if (handingOver && !rider) return NextResponse.json({ error: "Enter the rider's name and a valid 10-digit mobile number." }, { status: 400 });
    // Both transition RPCs save this note in the same transaction as the status.
    const transitionNote = rider ? riderHandoverNote(rider) : rejectReason || null;
    const sb = getSupabaseAdminClient();
    if (sb) {
      if (PUBLIC_MERCHANT_ACCESS && actor === "merchant") {
        const { data, error } = await sb.rpc("transition_public_order", {
          target_order_id: orderId, acting_user: null, next_status: nextStatus,
          preparation_minutes: prepTimeMin || 20, rejection_reason: transitionNote,
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
      const user = await getVerifiedUser(req);
      if (!user) {
        if (!guestHash || nextStatus !== "cancelled") return NextResponse.json({ error: "Order status change is not allowed." }, { status: 403 });
        return NextResponse.json({ error: "Order can only be cancelled before the restaurant accepts it, from the browser that placed it." }, { status: 400 });
      }
      const session = (await getSupabaseServerClient(req))!;
      const { data: visible } = await session.from("orders").select("id, outlet_id").eq("id", orderId).maybeSingle();
      if (!visible) return NextResponse.json({ error: "Order not found" }, { status: 404 });
      if (actor === "merchant") {
        const [{ data: membership }, { data: admin }] = await Promise.all([
          session.from("staff").select("outlet_id").eq("user_id", user.id).eq("outlet_id", visible.outlet_id).maybeSingle(),
          session.from("super_admins").select("user_id").eq("user_id", user.id).maybeSingle(),
        ]);
        if (!membership && !admin) return NextResponse.json({ error: "Store staff access required." }, { status: 403 });
      }
      const { data, error } = await sb.rpc("transition_order", {
        target_order_id: visible.id, acting_user: user.id, next_status: nextStatus,
        preparation_minutes: prepTimeMin || 20, rejection_reason: transitionNote,
      });
      if (error) return NextResponse.json({ error: "Order status change was not allowed. Please refresh and try again." }, { status: 400 });
      return NextResponse.json({ order: publicOrder(data) });
    }
    return NextResponse.json({ error: "Authenticated ordering service required." }, { status: 401 });
  } catch (err) {
    console.error("Order status PATCH error:", err);
    return NextResponse.json(
      { error: "Failed to update order status" },
      { status: 500 }
    );
  }
}
