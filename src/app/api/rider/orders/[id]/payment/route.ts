import { getVerifiedUser } from "@/lib/supabase/server";
import { getRiderAccount, isRiderUuid, riderError, riderJson, riderRpcError } from "@/lib/rider-access";
import { cashfreeConfig, cashfreeEnabled } from "@/lib/cashfree";
import { createCashfreeDeliveryQr, reconcileCashfreeOrder } from "@/lib/cashfree-orders";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!/^Bearer [^\s]+$/i.test(request.headers.get("authorization") || "")) return riderJson({ error: "Sign in again." }, 401);
    const user = await getVerifiedUser(request);
    if (!user) return riderJson({ error: "Sign in again." }, 401);
    const { id } = await params;
    if (!isRiderUuid(id)) return riderJson({ error: "Invalid order." }, 400);
    const body = await request.json();
    if (!["start", "check"].includes(body.action)) return riderJson({ error: "Invalid payment action." }, 400);
    const { db, account } = await getRiderAccount(user.id);
    const { data: order, error } = await db.from("orders").select("id,status,payment_method,payment_status,collection_method,customer_phone")
      .eq("id", id).eq("rider_id", account.rider_id).eq("outlet_id", account.outlet_id).eq("order_type", "delivery").maybeSingle();
    if (error) throw error;
    if (!order || order.status !== "out_for_delivery" || order.payment_method !== "cod") return riderJson({ error: "Order unavailable." }, 404);
    if (order.payment_status === "paid") return riderJson({ paid: true, delivered: order.status === "delivered" && order.collection_method === "upi_delivery" });
    if (order.payment_status !== "pending") return riderJson({ error: "Payment requires store review. Do not collect again." }, 409);
    if (body.action === "check") return riderJson(await reconcileCashfreeOrder(id));
    if (!cashfreeEnabled()) return riderJson({ error: "UPI is not configured. Ask your store to complete payment setup." }, 503);
    const { error: startError } = await db.rpc("start_rider_payment", { target_order_id: id, acting_user: user.id, selected_environment: cashfreeConfig().mode });
    if (startError) return riderRpcError(startError);
    return riderJson(await createCashfreeDeliveryQr(order));
  } catch (error) { return riderError(error); }
}
