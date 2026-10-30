import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/server-db";
import type { Address, RegisteredRider, RiderDashboardData, RiderDelivery } from "@/types/database";

export const isRiderUuid = (value: unknown): value is string =>
  typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

export class RiderAccessError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export function getRiderDb() {
  const db = getSupabaseAdminClient();
  if (!db) throw new RiderAccessError(503, "Rider service is not configured. Contact your store.");
  return db;
}

export function riderJson(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store", Vary: "Cookie, Authorization" } });
}

export function riderError(error: unknown) {
  return error instanceof RiderAccessError
    ? riderJson({ error: error.message }, error.status)
    : riderJson({ error: "Rider service is unavailable. Please retry or contact your store." }, 503);
}

export function riderRpcError(error: { code?: string }) {
  if (error.code === "42501") return riderJson({ error: "This order is not available to your account." }, 404);
  if (error.code === "22023") return riderJson({ error: "Order or rider changed. Refresh before trying again." }, 409);
  return riderJson({ error: "Rider service is unavailable. Please retry or contact your store." }, 503);
}

interface RiderAccount {
  rider_id: string;
  outlet_id: string;
  rider: RegisteredRider & { is_active: boolean };
  outlet: { name: string };
}

// This module is used only by server route handlers after verifying the caller.
export async function getRiderAccount(userId: string) {
  const db = getRiderDb();
  const { data, error } = await db.from("rider_accounts")
    .select("rider_id,outlet_id,rider:riders!inner(id,name,phone,is_active),outlet:outlets!inner(name)")
    .eq("user_id", userId).eq("is_active", true).maybeSingle();
  if (error) throw new RiderAccessError(503, "Rider access is not available yet. Contact your store.");
  const account = data as unknown as RiderAccount | null;
  if (!account || !account.rider.is_active) throw new RiderAccessError(403, "No active rider access. Ask your store to activate your rider account.");
  return { db, account };
}

interface DeliveryRow {
  id: string; order_no: string; customer_name: string; customer_phone: string;
  address_snapshot: Address | null; special_instructions: string | null;
  grand_total: number; payment_method: string; payment_status: string;
  items: { item_name: string; qty: number; variant: string | null }[];
}

export function toRiderDelivery(order: DeliveryRow): RiderDelivery {
  const address = order.address_snapshot;
  const due = order.payment_method === "cod" && order.payment_status !== "paid" ? Number(order.grand_total) : 0;
  if (!Number.isFinite(due) || due < 0) throw new RiderAccessError(503, "Order amount is unavailable. Contact your store.");
  return {
    id: order.id, order_no: order.order_no, customer_name: order.customer_name,
    customer_phone: order.customer_phone,
    address: address ? { house: address.house, landmark: address.landmark, locality: address.locality, city: address.city, lat: address.lat, lng: address.lng } : null,
    instructions: order.special_instructions || "", cod_due: due,
    payment_label: due > 0 ? "Cash on delivery" : order.payment_status === "paid" ? "Paid — do not collect cash" : "No cash due",
    items: (order.items || []).map(item => ({ name: item.item_name, qty: item.qty, variant: item.variant })),
  };
}

export async function getRiderDashboard(userId: string): Promise<RiderDashboardData> {
  const { db, account } = await getRiderAccount(userId);
  const scope = () => db.from("orders");
  const [active, history] = await Promise.all([
    scope().select("id,order_no,customer_name,customer_phone,address_snapshot,special_instructions,grand_total,payment_method,payment_status,items:order_items(item_name,qty,variant)")
      .eq("rider_id", account.rider_id).eq("outlet_id", account.outlet_id).eq("order_type", "delivery")
      .eq("status", "out_for_delivery").or("payment_method.eq.cod,payment_status.eq.paid")
      .order("placed_at", { ascending: true }).limit(101),
    scope().select("id,order_no,delivered_at")
      .eq("rider_id", account.rider_id).eq("outlet_id", account.outlet_id).eq("order_type", "delivery").eq("status", "delivered")
      .gte("delivered_at", new Date(Date.now() - 7 * 86400000).toISOString())
      .order("delivered_at", { ascending: false }).limit(20),
  ]);
  if (active.error || history.error) throw new RiderAccessError(503, "Could not load deliveries. Please retry.");
  return {
    rider: { name: account.rider.name, outlet_name: account.outlet.name },
    active: (active.data || []).slice(0, 100).map(row => toRiderDelivery(row as unknown as DeliveryRow)),
    active_limit_reached: (active.data || []).length > 100,
    history: (history.data || []) as RiderDashboardData["history"],
  };
}

export async function getAssignableRiders(userId: string, orderId: string): Promise<RegisteredRider[]> {
  const db = getRiderDb();
  const order = await db.from("orders").select("outlet_id,order_type,status").eq("id", orderId).maybeSingle();
  if (order.error) throw new RiderAccessError(503, "Could not load rider options.");
  if (!order.data) throw new RiderAccessError(404, "Order not found.");
  const [staff, admin] = await Promise.all([
    db.from("staff").select("user_id").eq("user_id", userId).eq("outlet_id", order.data.outlet_id).maybeSingle(),
    db.from("super_admins").select("user_id").eq("user_id", userId).maybeSingle(),
  ]);
  if (staff.error || admin.error) throw new RiderAccessError(503, "Could not verify store access.");
  if (!staff.data && !admin.data) throw new RiderAccessError(404, "Order not found.");
  if (order.data.order_type !== "delivery" || order.data.status !== "ready") throw new RiderAccessError(409, "This order is not ready for rider handover.");
  const result = await db.from("rider_accounts").select("rider:riders!inner(id,name,phone,is_active)")
    .eq("outlet_id", order.data.outlet_id).eq("is_active", true).eq("rider.is_active", true).limit(100);
  if (result.error) throw new RiderAccessError(503, "Registered riders are unavailable. Manual handover is still available.");
  return (result.data || []).map(row => {
    const rider = (row as unknown as { rider: RegisteredRider }).rider;
    return { id: rider.id, name: rider.name, phone: rider.phone };
  }).sort((a, b) => a.name.localeCompare(b.name));
}
