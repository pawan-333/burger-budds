"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { GlobalHeader } from "@/components/layout/GlobalHeader";
import { GlobalFooter } from "@/components/layout/GlobalFooter";
import type { OrderRecord } from "@/types/database";

export default function TrackOrdersPage() {
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/orders", { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to load orders");
        const data = await response.json();
        setOrders(Array.isArray(data.orders) ? data.orders : []);
        setState("ready");
      })
      .catch(() => { if (!controller.signal.aborted) setState("error"); });
    return () => controller.abort();
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-surface-page text-text-primary">
      <GlobalHeader />
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-10 space-y-5">
        <h1 className="text-2xl font-extrabold">Track Your Burger Budds Orders</h1>
        <p className="text-sm text-text-secondary">Orders placed in this browser or linked to your signed-in account appear here.</p>
        <div aria-live="polite" className="space-y-3">
          {state === "loading" && <p role="status">Loading your orders…</p>}
          {state === "error" && <p role="alert">Unable to load your orders. Please refresh and try again.</p>}
          {state === "ready" && orders.length === 0 && <p>No orders found. Use the same browser you used to place your order.</p>}
          {orders.map((order) => (
            <Link key={order.id} href={`/track/${encodeURIComponent(order.id)}`} className="block p-5 rounded-md bg-surface-base border border-border-subtle shadow-card hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary">
              <span className="font-extrabold">Order {order.id}</span>
              <span className="block text-sm text-text-secondary capitalize">{order.status.replace(/_/g, " ")}</span>
            </Link>
          ))}
        </div>
        <Link href="/" className="inline-flex min-h-[44px] items-center font-bold text-brand-secondary hover:underline">Browse the menu</Link>
      </main>
      <GlobalFooter />
    </div>
  );
}
