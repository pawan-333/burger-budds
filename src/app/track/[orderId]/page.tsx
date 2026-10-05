"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Bike,
  CheckCircle2,
  ChefHat,
  Clock,
  MapPin,
  PackageCheck,
  Phone,
  Receipt,
  Store,
  XCircle,
} from "lucide-react";
import { GlobalHeader } from "@/components/layout/GlobalHeader";
import { GlobalFooter } from "@/components/layout/GlobalFooter";
import { DietBadge } from "@/components/ui/DietBadge";
import { OrderRecord, OrderStatus } from "@/types/database";
import { DEFAULT_OUTLET_SLUG, SEED_OUTLET } from "@/lib/seed-data";
import { useApp } from "@/context/AppContext";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

const TIMELINE_STEPS: Array<{
  status: OrderStatus;
  label: string;
  desc: string;
  icon: React.ElementType;
}> = [
  {
    status: "placed",
    label: "Order Placed",
    desc: "Sent to Burger Budds kitchen",
    icon: Receipt,
  },
  {
    status: "accepted",
    label: "Accepted",
    desc: "Restaurant confirmed your order",
    icon: Store,
  },
  {
    status: "preparing",
    label: "Preparing",
    desc: "Searing fresh patties on the grill",
    icon: ChefHat,
  },
  {
    status: "ready",
    label: "Ready for Pickup",
    desc: "Packed hot & crispy with dips",
    icon: PackageCheck,
  },
  {
    status: "out_for_delivery",
    label: "Out for Delivery",
    desc: "Rider is on the way to your pin",
    icon: Bike,
  },
  {
    status: "delivered",
    label: "Delivered",
    desc: "Enjoy your Burger Budds meal!",
    icon: CheckCircle2,
  },
];

export default function OrderTrackingPage() {
  const params = useParams<{ orderId: string }>();
  const orderId = params?.orderId || "ord-demo-1001";
  const { notifyRealtimeUpdate } = useApp();

  const [order, setOrder] = useState<OrderRecord | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [cancelling, setCancelling] = useState<boolean>(false);

  const fetchOrder = useCallback(async () => {
    try {
      const res = await fetch(`/api/orders?id=${orderId}`, {
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        if (data.order) setOrder(data.order);
      }
    } catch {
      // Ignore
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    fetchOrder();

    // 1. BroadcastChannel for instant merchant -> customer updates
    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel("burger-budds-realtime");
      channel.onmessage = (ev) => {
        if (
          ev.data?.type === "order_updated" ||
          ev.data?.type === "order_created"
        ) {
          fetchOrder();
        }
      };
    } catch {
      // Ignore
    }

    // 2. Supabase Realtime subscription on orders table
    const sb = getSupabaseBrowserClient();
    const sub = sb
      ?.channel(`track-${orderId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => fetchOrder()
      )
      .subscribe();

    // 3. Poll every 2s
    const timer = setInterval(fetchOrder, 2000);

    return () => {
      if (channel) channel.close();
      if (sub && sb) sb.removeChannel(sub);
      clearInterval(timer);
    };
  }, [fetchOrder, orderId]);

  const handleCancelOrder = async () => {
    if (!order || order.status !== "placed") return;
    setCancelling(true);
    try {
      const res = await fetch(`/api/orders/${order.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "cancelled",
          actor: "customer",
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setOrder(data.order);
        notifyRealtimeUpdate("order_updated", data.order);
      }
    } finally {
      setCancelling(false);
    }
  };

  const currentStepIndex = order
    ? TIMELINE_STEPS.findIndex((s) => s.status === order.status)
    : 0;

  return (
    <div className="min-h-screen flex flex-col bg-surface-page text-text-primary">
      <GlobalHeader />

      <main className="flex-1 max-w-4xl w-full mx-auto px-3 sm:px-6 py-6 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <Link
            href={`/order/${DEFAULT_OUTLET_SLUG}`}
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-extrabold text-brand-secondary hover:underline"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Menu</span>
          </Link>
          <Link
            href="/merchant"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xs bg-brand-secondary text-text-onSecondary text-xs font-extrabold"
          >
            <Store className="w-3.5 h-3.5 text-brand-primary" />
            <span>Open Merchant POS to Update Status Live →</span>
          </Link>
        </div>

        {loading ? (
          <div className="p-8 rounded-md bg-surface-base border border-border-subtle text-center text-sm font-bold text-text-secondary">
            Loading live order status...
          </div>
        ) : !order ? (
          <div className="p-8 rounded-md bg-surface-base border border-border-subtle text-center space-y-3">
            <p className="text-base font-extrabold">Order Not Found</p>
            <Link
              href={`/order/${DEFAULT_OUTLET_SLUG}`}
              className="inline-flex px-4 py-2 rounded-xs bg-brand-primary text-text-onPrimary text-xs font-extrabold"
            >
              Return to Menu
            </Link>
          </div>
        ) : (
          <>
            {/* Top Status Hero Card */}
            <section className="rounded-md bg-surface-base border border-border-subtle p-5 shadow-card space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border-subtle pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-xs bg-brand-primary text-text-onPrimary text-xs font-extrabold">
                      Order #{order.order_no}
                    </span>
                    <span className="text-xs font-bold text-text-muted">
                      • {order.order_type.toUpperCase()}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-pill bg-status-openSoft text-status-open text-[11px] font-extrabold">
                      <span className="w-2 h-2 rounded-pill bg-status-open animate-ping" />
                      Realtime Active
                    </span>
                  </div>
                  <h1 className="text-lg sm:text-xl font-extrabold text-text-primary mt-1.5">
                    {order.status === "rejected"
                      ? "Order Rejected by Outlet"
                      : order.status === "cancelled"
                      ? "Order Cancelled"
                      : order.status === "delivered"
                      ? "Order Delivered!"
                      : `Estimated Arrival in ~${order.prep_time_min + 10} Mins`}
                  </h1>
                  <p className="text-xs font-medium text-text-secondary">
                    {SEED_OUTLET.name} • Placed at{" "}
                    {new Date(order.placed_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>

                {/* Cancel Button (Only while status === 'placed' per PLAN.md section 8) */}
                {order.status === "placed" && (
                  <button
                    type="button"
                    disabled={cancelling}
                    onClick={handleCancelOrder}
                    className="min-h-[40px] px-4 py-2 rounded-xs bg-status-errorSoft hover:bg-status-error text-status-error hover:text-text-onSecondary font-extrabold text-xs transition duration-fast"
                  >
                    {cancelling ? "Cancelling..." : "Cancel Order"}
                  </button>
                )}
              </div>

              {/* Rejected / Cancelled Banner */}
              {(order.status === "rejected" ||
                order.status === "cancelled") && (
                <div
                  role="alert"
                  className="p-4 rounded-xs bg-status-errorSoft border border-status-error text-status-error flex items-start gap-3"
                >
                  <XCircle className="w-5 h-5 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-extrabold">
                      {order.status === "rejected"
                        ? `Rejected: ${order.reject_reason || "Kitchen busy"}`
                        : "You cancelled this order while it was in Placed state."}
                    </p>
                    <p className="text-xs mt-0.5">
                      If you paid online or used BB Coins, your refund is
                      processed automatically.
                    </p>
                  </div>
                </div>
              )}

              {/* 6-Step Live Status Timeline */}
              {order.status !== "rejected" && order.status !== "cancelled" && (
                <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 pt-2">
                  {TIMELINE_STEPS.map((step, idx) => {
                    const Icon = step.icon;
                    const isCompleted = idx <= currentStepIndex;
                    const isCurrent = idx === currentStepIndex;
                    return (
                      <div
                        key={step.status}
                        className={`p-3 rounded-sm border flex flex-col justify-between gap-2 transition duration-fast ${
                          isCurrent
                            ? "border-brand-secondary bg-brand-primarySoft shadow-1"
                            : isCompleted
                            ? "border-status-open/40 bg-status-openSoft/40"
                            : "border-border-subtle bg-surface-raised opacity-60"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className={`w-8 h-8 rounded-pill flex items-center justify-center ${
                              isCompleted
                                ? "bg-brand-secondary text-text-onSecondary"
                                : "bg-surface-base text-text-muted"
                            }`}
                          >
                            <Icon className="w-4 h-4" />
                          </span>
                          {isCompleted && (
                            <CheckCircle2 className="w-4 h-4 text-status-open" />
                          )}
                        </div>
                        <div>
                          <p className="text-xs font-extrabold text-text-primary">
                            {step.label}
                          </p>
                          <p className="text-[11px] text-text-secondary leading-tight mt-0.5">
                            {step.desc}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Rider Details & Call Button */}
              {order.order_type === "delivery" && (
                <div className="p-4 rounded-sm bg-brand-secondary text-text-onSecondary flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-pill bg-brand-primary text-text-onPrimary flex items-center justify-center font-extrabold">
                      <Bike className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs text-brand-primary font-extrabold uppercase">
                        Assigned Delivery Partner
                      </p>
                      <p className="text-sm font-extrabold">
                        {order.rider_name || "Rohit Tomar"} •Vaccinated &
                        Temperature Checked
                      </p>
                    </div>
                  </div>
                  <a
                    href={`tel:${order.rider_phone || "+919755011223"}`}
                    className="min-h-[40px] px-4 py-2 rounded-xs bg-brand-primary text-text-onPrimary font-extrabold text-xs inline-flex items-center justify-center gap-1.5"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>Call Rider ({order.rider_phone || "+91 97550 11223"})</span>
                  </a>
                </div>
              )}
            </section>

            {/* Bottom Grid: Order Items + Delivery Address & Bill Summary */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <section className="rounded-md bg-surface-base border border-border-subtle p-5 shadow-card space-y-3">
                <h2 className="text-sm font-extrabold uppercase tracking-wider text-text-secondary border-b border-border-subtle pb-2">
                  Order Items ({order.items.reduce((s, i) => s + i.qty, 0)})
                </h2>
                <ul className="divide-y divide-border-subtle">
                  {order.items.map((item) => (
                    <li
                      key={item.id}
                      className="py-2.5 flex items-start justify-between gap-3"
                    >
                      <div className="flex items-start gap-2">
                        <DietBadge diet={item.diet} size="sm" />
                        <div>
                          <p className="text-xs sm:text-sm font-extrabold text-text-primary">
                            {item.qty} × {item.item_name}
                          </p>
                          {item.variant && (
                            <p className="text-[11px] text-text-secondary">
                              Variant: {item.variant}
                            </p>
                          )}
                          {item.addons && item.addons.length > 0 && (
                            <p className="text-[11px] text-text-muted">
                              Add-ons:{" "}
                              {item.addons.map((a) => a.name).join(", ")}
                            </p>
                          )}
                        </div>
                      </div>
                      <span className="text-xs sm:text-sm font-extrabold text-text-primary">
                        ₹{item.unit_price * item.qty}
                      </span>
                    </li>
                  ))}
                </ul>

                {order.special_instructions && (
                  <div className="p-3 rounded-xs bg-surface-raised text-xs text-text-secondary">
                    <strong className="text-text-primary">Kitchen Note:</strong>{" "}
                    {order.special_instructions}
                  </div>
                )}
              </section>

              <section className="rounded-md bg-surface-base border border-border-subtle p-5 shadow-card space-y-3">
                <h2 className="text-sm font-extrabold uppercase tracking-wider text-text-secondary border-b border-border-subtle pb-2">
                  Bill & Delivery Summary
                </h2>
                {order.address_snapshot && (
                  <div className="p-3 rounded-xs bg-surface-raised text-xs space-y-0.5">
                    <p className="font-extrabold text-text-primary flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-brand-secondary" />
                      Delivering to {order.address_snapshot.label.toUpperCase()}
                    </p>
                    <p className="text-text-secondary">
                      {order.address_snapshot.house},{" "}
                      {order.address_snapshot.locality},{" "}
                      {order.address_snapshot.city}
                    </p>
                  </div>
                )}

                <div className="space-y-1.5 text-xs font-semibold text-text-secondary pt-1">
                  <div className="flex justify-between">
                    <span>Item Total</span>
                    <span>₹{order.item_total}</span>
                  </div>
                  {order.discount > 0 && (
                    <div className="flex justify-between text-status-open font-bold">
                      <span>Discount ({order.coupon_code})</span>
                      <span>− ₹{order.discount}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>GST (5%)</span>
                    <span>₹{order.tax}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Delivery Fee</span>
                    <span>
                      {order.delivery_fee === 0
                        ? "FREE"
                        : `₹${order.delivery_fee}`}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Platform Fee</span>
                    <span>₹{order.platform_fee}</span>
                  </div>
                  {order.wallet_used > 0 && (
                    <div className="flex justify-between text-brand-secondary font-bold">
                      <span>BB Coins Used</span>
                      <span>− ₹{order.wallet_used}</span>
                    </div>
                  )}
                  <div className="pt-2 border-t border-border-subtle flex justify-between text-sm font-extrabold text-text-primary">
                    <span>
                      Grand Total ({order.payment_method.toUpperCase()})
                    </span>
                    <span>₹{order.grand_total}</span>
                  </div>
                </div>
              </section>
            </div>
          </>
        )}
      </main>

      <GlobalFooter />
    </div>
  );
}
