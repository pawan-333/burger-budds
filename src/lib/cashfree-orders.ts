import { getSupabaseAdminClient } from "@/lib/server-db";
import { getVerifiedUser } from "@/lib/supabase/server";
import { getGuestOrderHash } from "@/lib/guest-session";
import { cashfreeConfig, cashfreeRequest, CashfreeOrder, CashfreePayment, successfulCashfreePayment } from "@/lib/cashfree";

export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function ownedCashfreeOrder(id: string) {
  if (!UUID_PATTERN.test(id)) return null;
  const db = getSupabaseAdminClient();
  if (!db) throw new Error("Payment service unavailable.");
  const [{ data: order, error }, user, guestHash] = await Promise.all([
    db.from("orders").select("*").eq("id", id).maybeSingle(), getVerifiedUser(), getGuestOrderHash(),
  ]);
  if (error) throw new Error("Payment service unavailable.");
  if (!order || order.payment_method !== "cashfree" ||
      !((user && user.id === order.user_id) || (guestHash && guestHash === order.guest_session_hash))) return null;
  return order;
}

async function paymentRecord(orderId: string) {
  const db = getSupabaseAdminClient();
  if (!db) throw new Error("Payment service unavailable.");
  const { data, error } = await db.from("cashfree_payments").select("*").eq("order_id", orderId).single();
  if (error || !data || data.environment !== cashfreeConfig(false).mode) throw new Error("Payment environment mismatch.");
  return { db, record: data };
}

export async function createCashfreeSession(order: { id: string; status: string; payment_status: string; customer_phone: string }) {
  const config = cashfreeConfig();
  if (order.payment_status === "paid" || ["cancelled", "rejected"].includes(order.status)) throw new Error("This order cannot be paid.");
  const { record } = await paymentRecord(order.id);
  if (record.state !== "pending" || Date.parse(record.expires_at) <= Date.now()) throw new Error("Payment session expired. Cancel this order and place a new one.");
  const endpoint = `/orders/${encodeURIComponent(record.provider_order_id)}`;
  let provider = await cashfreeRequest<CashfreeOrder>(endpoint);
  if (!provider) {
    provider = await cashfreeRequest<CashfreeOrder>("/orders", {
      key: order.id,
      body: {
        order_id: record.provider_order_id, order_amount: Number(record.amount), order_currency: "INR",
        order_expiry_time: record.expires_at,
        customer_details: { customer_id: order.id, customer_phone: order.customer_phone.replace(/\D/g, "").slice(-10) },
        order_meta: { return_url: `${config.origin}/track/${order.id}?order_id={order_id}`, notify_url: `${config.origin}/api/payments/cashfree/webhook`, payment_methods: "upi" },
      },
    });
  }
  if (!provider || provider.order_id !== record.provider_order_id || provider.order_status !== "ACTIVE" ||
      provider.order_currency !== "INR" || Math.round(Number(provider.order_amount) * 100) !== Math.round(Number(record.amount) * 100) || !provider.payment_session_id) {
    throw new Error("Payment session is not active. Refresh payment status before retrying.");
  }
  return { paymentSessionId: provider.payment_session_id, mode: config.mode };
}

export async function reconcileCashfreeOrder(orderId: string) {
  const { db, record } = await paymentRecord(orderId);
  if (record.state === "paid") return { paid: true, refundRequired: record.refund_required };
  const provider = await cashfreeRequest<CashfreeOrder>(`/orders/${encodeURIComponent(record.provider_order_id)}`);
  if (!provider) {
    if (Date.parse(record.expires_at) <= Date.now()) {
      const { error } = await db.rpc("expire_cashfree_order", { target_order_id: orderId });
      if (error) throw new Error("Payment status update unavailable.");
      return { paid: false, expired: true, refundRequired: false };
    }
    return { paid: false, refundRequired: false };
  }
  if (provider.order_id !== record.provider_order_id) throw new Error("Payment identity mismatch.");
  if (provider.order_status === "EXPIRED") {
    const { error } = await db.rpc("expire_cashfree_order", { target_order_id: orderId });
    if (error) throw new Error("Payment status update unavailable.");
    return { paid: false, expired: true, refundRequired: false };
  }
  if (provider.order_status !== "PAID") return { paid: false, refundRequired: false };
  const payments = await cashfreeRequest<CashfreePayment[]>(`/orders/${encodeURIComponent(record.provider_order_id)}/payments`);
  const payment = successfulCashfreePayment(provider, payments || [], record.provider_order_id, Number(record.amount));
  if (!payment) throw new Error("Payment verification mismatch.");
  const { data, error } = await db.rpc("confirm_cashfree_payment", {
    target_order_id: orderId, provider_order: record.provider_order_id,
    provider_payment: String(payment.cf_payment_id), paid_amount: Number(record.amount),
  });
  if (error) throw new Error("Payment status update unavailable.");
  return { paid: true, refundRequired: Boolean(data?.refund_required) };
}
