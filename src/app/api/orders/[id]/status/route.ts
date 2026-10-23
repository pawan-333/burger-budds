import { NextRequest, NextResponse } from "next/server";
import {
  getSupabaseAdminClient,
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
        preparation_minutes: prepTimeMin || 20, rejection_reason: rejectReason || null,
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
