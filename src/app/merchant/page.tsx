"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  BellRing,
  Bike,
  CheckCircle2,
  ChefHat,
  Clock,
  Download,
  ExternalLink,
  BarChart3,
  PackageCheck,
  Phone,
  Power,
  Printer,
  RefreshCw,
  Settings,
  Sliders,
  Store,
  Utensils,
  Volume2,
  VolumeX,
  Wifi,
  XCircle,
} from "lucide-react";
import {
  Category,
  MenuItem,
  OrderRecord,
  OrderStatus,
  Outlet,
  StaffRole,
} from "@/types/database";
import { DietBadge } from "@/components/ui/DietBadge";
import { DEFAULT_OUTLET_SLUG, SEED_OUTLET } from "@/lib/seed-data";
import { useApp } from "@/context/AppContext";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { MerchantLogin } from "@/components/merchant/MerchantLogin";
import { PUBLIC_MERCHANT_ACCESS } from "@/lib/site-access";
import { verifyMerchantAccess } from "@/lib/merchant-access";

export default function MerchantAppPage() {
  const { notifyRealtimeUpdate } = useApp();

  // Staff Role & Screen Navigation
  const [merchantSlug, setMerchantSlug] = useState(DEFAULT_OUTLET_SLUG);
  const [staffRole, setStaffRole] = useState<StaffRole>("owner");
  const [staffAccess, setStaffAccess] = useState<"checking" | "login" | "denied" | "allowed">("checking");
  const [accessMessage, setAccessMessage] = useState("");
  const verifyStaffAccess = useCallback(async () => {
    setStaffAccess("checking");
    if (PUBLIC_MERCHANT_ACCESS) { setStaffAccess("allowed"); return; }
    const sb = getSupabaseBrowserClient();
    if (!sb) { setAccessMessage("Merchant login is not configured. Contact your administrator."); setStaffAccess("denied"); return; }
    const result = await verifyMerchantAccess(sb, new URLSearchParams(window.location.search).get("outlet"));
    if (result.status === "admin") { window.location.assign("/admin"); return; }
    if (result.status === "allowed") { setMerchantSlug(result.slug); setStaffRole(result.role); }
    if (result.status === "denied") setAccessMessage(result.message);
    setStaffAccess(result.status);
  }, []);
  useEffect(() => { void verifyStaffAccess(); }, [verifyStaffAccess]);
  const [activeScreen, setActiveScreen] = useState<
    "orders" | "menu" | "controls" | "reports"
  >("orders");
  const [orderTab, setOrderTab] = useState<
    "new" | "preparing" | "ready" | "completed"
  >("new");

  // Live Data State
  const [outlet, setOutlet] = useState<Outlet>(SEED_OUTLET);
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [connected, setConnected] = useState<boolean>(true);
  const [orderActionError, setOrderActionError] = useState<string | null>(null);

  // Audio Alarm State (Looping kitchen alarm when unaccepted 'placed' orders exist)
  const [audioUnlocked, setAudioUnlocked] = useState<boolean>(false);
  const [soundMuted, setSoundMuted] = useState<boolean>(false);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Prep time selection per order & Reject Modal state
  const [selectedPrepTimes, setSelectedPrepTimes] = useState<
    Record<string, number>
  >({});
  const [rejectingOrderId, setRejectingOrderId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState<string>(
    "Item out of stock"
  );
  const [printingOrder, setPrintingOrder] = useState<OrderRecord | null>(null);

  const playKitchenBellTone = useCallback(() => {
    if (!audioUnlocked || soundMuted || typeof window === "undefined") return;
    try {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioContextClass();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") {
        ctx.resume();
      }

      const now = ctx.currentTime;
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = "triangle";
      osc2.type = "sine";
      osc1.frequency.setValueAtTime(880, now); // A5
      osc1.frequency.setValueAtTime(1174.66, now + 0.18); // D6
      osc2.frequency.setValueAtTime(1760, now);

      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.65);
      osc2.stop(now + 0.65);
    } catch {
      // Ignore audio errors
    }
  }, [audioUnlocked, soundMuted]);

  const unlockAudio = () => {
    setAudioUnlocked(true);
    setSoundMuted(false);
    setTimeout(() => playKitchenBellTone(), 50);
  };

  const fetchMerchantData = useCallback(async () => {
    if (staffAccess !== "allowed") return;
    try {
      const [menuRes, ordersRes] = await Promise.all([
        fetch(`/api/menu?outlet=${encodeURIComponent(merchantSlug)}`, { cache: "no-store" }),
        fetch(`/api/orders?merchant=1&outlet=${encodeURIComponent(merchantSlug)}`, { cache: "no-store" }),
      ]);
      if (menuRes.ok) {
        const menuData = await menuRes.json();
        if (menuData.outlet) setOutlet(menuData.outlet);
        if (Array.isArray(menuData.categories))
          setCategories(menuData.categories);
        if (Array.isArray(menuData.items)) setItems(menuData.items);
      }
      if (ordersRes.ok) {
        const ordersData = await ordersRes.json();
        if (Array.isArray(ordersData.orders)) setOrders(ordersData.orders);
      }
      setConnected(true);
    } catch {
      setConnected(false);
    }
  }, [staffAccess, merchantSlug]);

  useEffect(() => {
    fetchMerchantData();

    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel("burger-budds-realtime");
      channel.onmessage = () => {
        fetchMerchantData();
      };
    } catch {
      // Ignore
    }

    const sb = getSupabaseBrowserClient();
    const sub = sb
      ?.channel("merchant-pos-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => fetchMerchantData()
      )
      .subscribe();

    const pollInterval = setInterval(fetchMerchantData, 2000);

    return () => {
      if (channel) channel.close();
      if (sub && sb) sb.removeChannel(sub);
      clearInterval(pollInterval);
    };
  }, [fetchMerchantData]);

  const newOrders = useMemo(
    () => orders.filter((o) => o.status === "placed"),
    [orders]
  );
  const preparingOrders = useMemo(
    () =>
      orders.filter((o) => o.status === "accepted" || o.status === "preparing"),
    [orders]
  );
  const readyOrders = useMemo(
    () =>
      orders.filter(
        (o) => o.status === "ready" || o.status === "out_for_delivery"
      ),
    [orders]
  );
  const completedOrders = useMemo(
    () =>
      orders.filter(
        (o) =>
          o.status === "delivered" ||
          o.status === "rejected" ||
          o.status === "cancelled"
      ),
    [orders]
  );

  // Looping alarm every 2.5 seconds whenever there is an unaccepted 'placed' order
  useEffect(() => {
    if (newOrders.length === 0 || !audioUnlocked || soundMuted) return;
    playKitchenBellTone();
    const alarmTimer = setInterval(playKitchenBellTone, 2500);
    return () => clearInterval(alarmTimer);
  }, [newOrders.length, audioUnlocked, soundMuted, playKitchenBellTone]);

  const handleOrderStatusChange = async (
    orderId: string,
    status: OrderStatus,
    extra?: { prepTimeMin?: number; rejectReason?: string }
  ) => {
    setOrderActionError(null);
    try {
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          actor: "merchant",
          prepTimeMin: extra?.prepTimeMin,
          rejectReason: extra?.rejectReason,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        await fetchMerchantData();
        notifyRealtimeUpdate("order_updated", data.order);
        setRejectingOrderId(null);
      } else {
        const data = await res.json();
        setOrderActionError(data.error || "Unable to update order. Please refresh and try again.");
      }
    } catch {
      setOrderActionError("Connection failed. Please try again.");
    }
  };

  const handleToggleItemStock = async (
    itemId: string,
    isAvailable: boolean
  ) => {
    // Optimistic update
    setItems((prev) =>
      prev.map((it) =>
        it.id === itemId ? { ...it, is_available: isAvailable } : it
      )
    );
    await fetch("/api/menu", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "update_item",
        itemId,
        is_available: isAvailable,
      }),
    });
    notifyRealtimeUpdate("menu_updated", { itemId, isAvailable });
  };

  const handleUpdateItemPrice = async (itemId: string, newPrice: number) => {
    if (Number.isNaN(newPrice) || newPrice <= 0) return;
    setItems((prev) =>
      prev.map((it) => (it.id === itemId ? { ...it, price: newPrice } : it))
    );
    await fetch("/api/menu", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "update_item",
        itemId,
        price: newPrice,
      }),
    });
    notifyRealtimeUpdate("menu_updated", { itemId, price: newPrice });
  };

  const handleToggleCategoryStock = async (
    categoryId: string,
    isAvailable: boolean
  ) => {
    setItems((prev) =>
      prev.map((it) =>
        it.category_id === categoryId
          ? { ...it, is_available: isAvailable }
          : it
      )
    );
    await fetch("/api/menu", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "toggle_category_stock",
        categoryId,
        is_available: isAvailable,
      }),
    });
    notifyRealtimeUpdate("menu_updated", { categoryId, isAvailable });
  };

  const handleUpdateOutletControls = async (patch: {
    is_open?: boolean;
    prep_time_min?: number;
    delivery_enabled?: boolean;
    pause_minutes?: number;
  }) => {
    const res = await fetch("/api/menu", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "update_outlet", outletSlug: merchantSlug,
        ...patch,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.outlet) setOutlet(data.outlet);
      notifyRealtimeUpdate("menu_updated", data.outlet);
    }
  };

  // Simulate an incoming live order for instant testing of alarm & realtime flow
  const handleSimulateNewOrder = async () => {
    if (!audioUnlocked) unlockAudio();
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        outletSlug: merchantSlug,
        customerName: "Vikramaditya Scindia",
        customerPhone: "+91 98260 77889",
        orderType: "delivery",
        paymentMethod: "cod",
        couponCode: "FLAT129",
        specialInstructions: "Extra peri-peri seasoning on fries, ring bell once",
        address: {
          id: "addr-sim",
          user_id: "sim-user",
          label: "home",
          house: "14, Jai Vilas Enclave, Vinay Nagar",
          landmark: "Near Sector 3 Market",
          phone: "+91 98260 77889",
          email: "vikram@example.com",
          lat: 26.2201,
          lng: 78.1815,
          locality: "Vinay Nagar, Gwalior",
          city: "Gwalior",
        },
        items: [
          {
            itemId: "33333333-3333-3333-3333-333333333303",
            variantId: "44444444-4444-4444-4444-444444444402",
            addonIds: ["66666666-6666-6666-6666-666666666601"],
            qty: 1,
          },
          {
            itemId: "33333333-3333-3333-3333-333333333309",
            qty: 1,
          },
        ],
      }),
    });
    if (res.ok) {
      const data = await res.json();
      await fetchMerchantData();
      setActiveScreen("orders");
      setOrderTab("new");
      notifyRealtimeUpdate("order_created", data.order);
    }
  };

  const handlePrintKot = (ord: OrderRecord) => {
    setPrintingOrder(ord);
    setTimeout(() => {
      window.print();
    }, 150);
  };

  const handleExportCsv = () => {
    const headers = [
      "Order No",
      "Placed At",
      "Customer",
      "Phone",
      "Type",
      "Status",
      "Payment",
      "Grand Total (INR)",
    ];
    const rows = orders.map((o) => [
      o.order_no,
      o.placed_at,
      `"${o.customer_name}"`,
      o.customer_phone,
      o.order_type,
      o.status,
      o.payment_method,
      o.grand_total,
    ]);
    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `burger-budds-orders-${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const visibleOrders =
    orderTab === "new"
      ? newOrders
      : orderTab === "preparing"
      ? preparingOrders
      : orderTab === "ready"
      ? readyOrders
      : completedOrders;

  const totalRevenue = orders
    .filter((o) => o.status !== "rejected" && o.status !== "cancelled")
    .reduce((sum, o) => sum + o.grand_total, 0);

  if (staffAccess === "checking") return <main className="min-h-screen p-6 bg-surface-page" role="status">Checking staff access…</main>;
  if (staffAccess === "login") return <MerchantLogin onSuccess={() => void verifyStaffAccess()} />;
  if (staffAccess === "denied") return <main className="min-h-screen p-6 bg-surface-page space-y-4"><h1 className="text-xl font-bold">Staff access required</h1><p role="alert">{accessMessage}</p><button className="min-h-[44px] px-4 bg-brand-primary rounded-xs" onClick={() => void verifyStaffAccess()}>Retry access check</button><button className="min-h-[44px] px-4 bg-brand-primary rounded-xs" onClick={async () => { await getSupabaseBrowserClient()?.auth.signOut(); setStaffAccess("login"); }}>Sign in with another email</button></main>;

  return (
    <div className="min-h-screen flex flex-col bg-surface-page text-text-primary">
      {/* Top Merchant PWA Bar */}
      <header className="sticky top-0 z-40 bg-brand-secondary text-text-onSecondary shadow-card print:hidden">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.png"
              alt="Burger Budds Merchant"
              className="h-10 w-auto object-contain"
            />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base sm:text-lg font-extrabold text-brand-primary leading-none">
                  MERCHANT POS
                </span>
                <span
                  className={`px-2 py-0.5 rounded-pill text-[10px] font-extrabold uppercase inline-flex items-center gap-1 ${
                    connected
                      ? "bg-status-open text-text-onSecondary"
                      : "bg-status-error text-text-onSecondary"
                  }`}
                >
                  <Wifi className="w-3 h-3" />
                  {connected ? "Connected" : "Offline"}
                </span>
              </div>
              <p className="text-[11px] text-text-onSecondary/85">
                {outlet.name} • Store is{" "}
                <strong>{outlet.is_open ? "OPEN" : "CLOSED"}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center flex-wrap gap-2">
            {/* Unlock Audio / Sound Toggle Button */}
            {!audioUnlocked ? (
              <button
                type="button"
                onClick={unlockAudio}
                className="min-h-[40px] px-3.5 py-1.5 rounded-xs bg-brand-primary hover:bg-brand-primaryHover text-text-onPrimary font-extrabold text-xs inline-flex items-center gap-1.5 shadow-1 animate-pulse"
              >
                <Volume2 className="w-4 h-4" />
                <span>Tap to Unlock Kitchen Alarm Sound</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setSoundMuted((m) => !m)}
                className="min-h-[40px] px-3 py-1.5 rounded-xs bg-brand-secondaryDark text-text-onSecondary font-bold text-xs inline-flex items-center gap-1.5 border border-text-onSecondary/20"
              >
                {soundMuted ? (
                  <>
                    <VolumeX className="w-4 h-4 text-status-error" />
                    <span>Alarm Muted</span>
                  </>
                ) : (
                  <>
                    <Volume2 className="w-4 h-4 text-brand-primary" />
                    <span>Alarm Active</span>
                  </>
                )}
              </button>
            )}

            {/* Simulate Incoming Order Button for Quick Testing */}
            {process.env.NODE_ENV !== "production" && !getSupabaseBrowserClient() && <button
              type="button"
              onClick={handleSimulateNewOrder}
              className="min-h-[40px] px-3 py-1.5 rounded-xs bg-surface-base text-text-primary hover:bg-brand-primary font-extrabold text-xs inline-flex items-center gap-1.5 shadow-1"
            >
              <BellRing className="w-3.5 h-3.5 text-status-error" />
              <span>+ Simulate New Order</span>
            </button>}

            <button type="button" className="min-h-[44px] px-3 text-xs font-bold" onClick={async () => { await getSupabaseBrowserClient()?.auth.signOut(); setOrders([]); setItems([]); setCategories([]); setStaffAccess("login"); }}>Sign out</button>
            {staffRole === "owner" && <Link href="/admin" className="min-h-[44px] px-3 py-2 font-bold text-xs">Super Admin</Link>}
            {/* Role Selector */}
            <select
              value={staffRole}
              disabled={!!getSupabaseBrowserClient()}
              onChange={(e) => setStaffRole(e.target.value as StaffRole)}
              aria-label="Select staff role"
              className="min-h-[40px] px-2.5 rounded-xs bg-brand-secondaryDark text-text-onSecondary text-xs font-bold border border-text-onSecondary/20"
            >
              <option value="owner">Role: Owner</option>
              <option value="manager">Role: Manager</option>
              <option value="staff">Role: Kitchen Staff</option>
            </select>

            <Link
              href={`/order/${merchantSlug}`}
              className="min-h-[40px] px-3 py-1.5 rounded-xs bg-brand-secondaryDark hover:bg-surface-dark text-text-onSecondary text-xs font-bold inline-flex items-center gap-1"
            >
              <span>Customer Site</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Navigation Tabs: Live Orders / Menu Manager / Store Controls / Reports */}
        <nav className="bg-brand-secondaryDark border-t border-text-onSecondary/15">
          <div className="max-w-7xl mx-auto px-3 sm:px-6 flex items-center gap-2 overflow-x-auto">
            {(
              [
                {
                  id: "orders",
                  label: `Live Orders (${newOrders.length} New)`,
                  icon: BellRing,
                },
                {
                  id: "menu",
                  label: `Menu & Stock (${items.filter((i) => !i.is_available).length} Out)`,
                  icon: Utensils,
                },
                {
                  id: "controls",
                  label: "Store Controls",
                  icon: Sliders,
                },
                {
                  id: "reports",
                  label: "Reports & CSV",
                  icon: BarChart3,
                },
              ] as const
            ).map((tab) => {
              const Icon = tab.icon;
              const active = activeScreen === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveScreen(tab.id)}
                  className={`min-h-[46px] px-4 py-2.5 text-xs sm:text-sm font-extrabold inline-flex items-center gap-2 border-b-4 shrink-0 transition duration-fast ${
                    active
                      ? "border-brand-primary text-brand-primary"
                      : "border-transparent text-text-onSecondary hover:text-brand-primary"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      </header>

      {/* Urgent Full-Width New Order Alert Banner when 'placed' orders are waiting */}
      {newOrders.length > 0 && (
        <div
          role="alert"
          className="bg-brand-primary text-text-onPrimary px-4 py-3 border-b-2 border-text-primary/20 shadow-card print:hidden"
        >
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-pill bg-status-error text-text-onSecondary flex items-center justify-center animate-bounce">
                <BellRing className="w-4 h-4" />
              </span>
              <div>
                <p className="text-sm sm:text-base font-extrabold">
                  NEW ORDER ALERT! {newOrders.length} Unaccepted{" "}
                  {newOrders.length === 1 ? "Order" : "Orders"} Waiting for
                  Kitchen Confirmation
                </p>
                <p className="text-xs font-bold">
                  Choose preparation time (10/15/20/30 min) and click Accept to
                  stop alarm.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setActiveScreen("orders");
                setOrderTab("new");
                if (!audioUnlocked) unlockAudio();
              }}
              className="min-h-[40px] px-4 py-1.5 rounded-xs bg-surface-dark text-text-onSecondary font-extrabold text-xs self-start sm:self-center"
            >
              View New Orders ({newOrders.length})
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 py-6 print:hidden">
        {orderActionError && <p role="alert" className="mb-4 p-3 bg-status-errorSoft text-status-error rounded-xs">{orderActionError}</p>}
        {/* SCREEN 1: LIVE ORDERS */}
        {activeScreen === "orders" && (
          <div className="space-y-5">
            {/* Sub-tabs: New / Preparing / Ready / Completed */}
            <div className="flex items-center flex-wrap gap-2">
              {(
                [
                  { id: "new", label: "New", count: newOrders.length },
                  {
                    id: "preparing",
                    label: "Preparing",
                    count: preparingOrders.length,
                  },
                  {
                    id: "ready",
                    label: "Ready / Out",
                    count: readyOrders.length,
                  },
                  {
                    id: "completed",
                    label: "Completed",
                    count: completedOrders.length,
                  },
                ] as const
              ).map((st) => {
                const isActive = orderTab === st.id;
                return (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setOrderTab(st.id)}
                    className={`min-h-[44px] px-4 py-2 rounded-xs font-extrabold text-xs sm:text-sm inline-flex items-center gap-2 border transition duration-fast ${
                      isActive
                        ? "bg-brand-secondary text-text-onSecondary border-brand-secondary shadow-1"
                        : "bg-surface-base text-text-primary border-border-muted hover:bg-surface-raised"
                    }`}
                  >
                    <span>{st.label}</span>
                    <span
                      className={`px-2 py-0.5 rounded-pill text-xs font-extrabold ${
                        isActive
                          ? "bg-brand-primary text-text-onPrimary"
                          : "bg-surface-raised text-text-secondary"
                      }`}
                    >
                      {st.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {visibleOrders.length === 0 ? (
              <div className="p-10 rounded-md bg-surface-base border border-border-subtle text-center space-y-3 shadow-card">
                <p className="text-base font-extrabold">
                  No orders in &ldquo;{orderTab.toUpperCase()}&rdquo; queue
                </p>
                <p className="text-xs text-text-secondary">
                  Place an order on the customer website or click &ldquo;+
                  Simulate New Order&rdquo; in the top bar.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {visibleOrders.map((ord) => {
                  const prepMin =
                    selectedPrepTimes[ord.id] ?? ord.prep_time_min ?? 20;

                  return (
                    <article
                      key={ord.id}
                      className={`rounded-md bg-surface-base border-2 p-5 shadow-card flex flex-col justify-between gap-4 ${
                        ord.status === "placed"
                          ? "border-brand-primary ring-2 ring-brand-primary/50"
                          : "border-border-subtle"
                      }`}
                    >
                      <div className="space-y-3">
                        {/* Order Header */}
                        <div className="flex items-start justify-between gap-2 border-b border-border-subtle pb-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-base font-extrabold text-text-primary">
                                #{ord.order_no}
                              </span>
                              <span className="px-2.5 py-0.5 rounded-pill bg-brand-secondary text-text-onSecondary text-[11px] font-extrabold uppercase">
                                {ord.status.replace(/_/g, " ")}
                              </span>
                              <span className="px-2 py-0.5 rounded-xs bg-surface-raised text-text-secondary text-[11px] font-bold uppercase">
                                {ord.order_type}
                              </span>
                            </div>
                            <p className="text-xs font-semibold text-text-secondary mt-1">
                              {ord.customer_name} •{" "}
                              <a
                                href={`tel:${ord.customer_phone}`}
                                className="text-brand-secondary font-bold underline"
                              >
                                {ord.customer_phone}
                              </a>
                            </p>
                          </div>

                          <div className="text-right">
                            <span
                              className={`px-2.5 py-1 rounded-xs text-xs font-extrabold inline-block ${
                                ord.payment_method === "cod"
                                  ? "bg-brand-primary text-text-onPrimary"
                                  : "bg-status-open text-text-onSecondary"
                              }`}
                            >
                              {ord.payment_method === "cod"
                                ? `COD ₹${ord.grand_total}`
                                : `PAID ₹${ord.grand_total}`}
                            </span>
                            <p className="text-[11px] text-text-muted mt-1">
                              {new Date(ord.placed_at).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </p>
                          </div>
                        </div>

                        {/* Line Items */}
                        <ul className="space-y-2">
                          {ord.items.map((item) => (
                            <li
                              key={item.id}
                              className="flex items-start justify-between text-xs sm:text-sm"
                            >
                              <div className="flex items-start gap-2">
                                <DietBadge diet={item.diet} size="sm" />
                                <div>
                                  <span className="font-extrabold text-text-primary">
                                    {item.qty} × {item.item_name}
                                  </span>
                                  {item.variant && (
                                    <p className="text-xs text-text-secondary">
                                      Size: {item.variant}
                                    </p>
                                  )}
                                  {item.addons && item.addons.length > 0 && (
                                    <p className="text-xs text-text-muted">
                                      +{" "}
                                      {item.addons
                                        .map((a) => a.name)
                                        .join(", ")}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <span className="font-bold text-text-primary">
                                ₹{item.unit_price * item.qty}
                              </span>
                            </li>
                          ))}
                        </ul>

                        {/* Special Instructions */}
                        {ord.special_instructions && (
                          <div className="p-2.5 rounded-xs bg-brand-primarySoft border border-brand-primary text-xs font-bold text-text-primary">
                            Kitchen Note: &ldquo;{ord.special_instructions}
                            &rdquo;
                          </div>
                        )}

                        {/* Delivery Address */}
                        {ord.address_snapshot && (
                          <div className="p-2.5 rounded-xs bg-surface-raised text-xs text-text-secondary">
                            <strong className="text-text-primary">
                              Deliver to:
                            </strong>{" "}
                            {ord.address_snapshot.house},{" "}
                            {ord.address_snapshot.locality} (
                            {ord.address_snapshot.distance_km ?? 1.2} km)
                          </div>
                        )}
                      </div>

                      {/* Order Actions Footer */}
                      <div className="pt-3 border-t border-border-subtle space-y-3">
                        {ord.status === "placed" && (
                          <div className="space-y-2.5">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-extrabold text-text-secondary">
                                Select Prep Time:
                              </span>
                              <div className="flex items-center gap-1.5">
                                {[10, 15, 20, 30].map((mins) => (
                                  <button
                                    key={mins}
                                    type="button"
                                    onClick={() =>
                                      setSelectedPrepTimes((prev) => ({
                                        ...prev,
                                        [ord.id]: mins,
                                      }))
                                    }
                                    className={`px-2.5 py-1 rounded-xs text-xs font-extrabold border ${
                                      prepMin === mins
                                        ? "bg-brand-secondary text-text-onSecondary border-brand-secondary"
                                        : "bg-surface-base text-text-primary border-border-muted"
                                    }`}
                                  >
                                    {mins}m
                                  </button>
                                ))}
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2.5">
                              <button
                                type="button"
                                onClick={() =>
                                  handleOrderStatusChange(ord.id, "accepted", {
                                    prepTimeMin: prepMin,
                                  })
                                }
                                className="min-h-[44px] rounded-xs bg-brand-primary hover:bg-brand-primaryHover text-text-onPrimary font-extrabold text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-1"
                              >
                                <CheckCircle2 className="w-4 h-4" />
                                <span>Accept ({prepMin} mins)</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => setRejectingOrderId(ord.id)}
                                className="min-h-[44px] rounded-xs bg-status-errorSoft hover:bg-status-error text-status-error hover:text-text-onSecondary font-extrabold text-xs sm:text-sm flex items-center justify-center gap-1.5"
                              >
                                <XCircle className="w-4 h-4" />
                                <span>Reject Order</span>
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Reject Reason Prompt */}
                        {rejectingOrderId === ord.id && (
                          <div className="p-3 rounded-xs bg-status-errorSoft border border-status-error space-y-2">
                            <label className="block text-xs font-extrabold text-status-error">
                              Reason for Rejection (Required):
                            </label>
                            <select
                              value={rejectReason}
                              onChange={(e) => setRejectReason(e.target.value)}
                              className="w-full min-h-[38px] px-2.5 rounded-xs border border-border-muted bg-surface-base text-xs font-bold text-text-primary"
                            >
                              <option value="Item out of stock">
                                Item out of stock
                              </option>
                              <option value="Kitchen overloaded / closing soon">
                                Kitchen overloaded / closing soon
                              </option>
                              <option value="Delivery rider unavailable in zone">
                                Delivery rider unavailable in zone
                              </option>
                            </select>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  handleOrderStatusChange(ord.id, "rejected", {
                                    rejectReason,
                                  })
                                }
                                className="flex-1 min-h-[38px] rounded-xs bg-status-error text-text-onSecondary text-xs font-extrabold"
                              >
                                Confirm Reject
                              </button>
                              <button
                                type="button"
                                onClick={() => setRejectingOrderId(null)}
                                className="px-3 min-h-[38px] rounded-xs bg-surface-base text-text-secondary text-xs font-bold"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}

                        {ord.status === "accepted" && (
                          <button
                            type="button"
                            onClick={() =>
                              handleOrderStatusChange(ord.id, "preparing")
                            }
                            className="w-full min-h-[44px] rounded-xs bg-brand-primary hover:bg-brand-primaryHover text-text-onPrimary font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-1"
                          >
                            <ChefHat className="w-4 h-4" />
                            <span>Mark Preparing</span>
                          </button>
                        )}

                        {ord.status === "preparing" && (
                          <button
                            type="button"
                            onClick={() =>
                              handleOrderStatusChange(ord.id, "ready")
                            }
                            className="w-full min-h-[44px] rounded-xs bg-brand-primary hover:bg-brand-primaryHover text-text-onPrimary font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-1"
                          >
                            <PackageCheck className="w-4 h-4" />
                            <span>Mark Ready for Pickup / Rider</span>
                          </button>
                        )}

                        {ord.status === "ready" && (
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                handleOrderStatusChange(
                                  ord.id,
                                  "out_for_delivery"
                                )
                              }
                              className="min-h-[44px] rounded-xs bg-brand-secondary text-text-onSecondary font-extrabold text-xs flex items-center justify-center gap-1.5"
                            >
                              <Bike className="w-4 h-4 text-brand-primary" />
                              <span>Hand Over to Rider</span>
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                handleOrderStatusChange(ord.id, "delivered")
                              }
                              className="min-h-[44px] rounded-xs bg-brand-primary text-text-onPrimary font-extrabold text-xs flex items-center justify-center gap-1.5"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              <span>Mark Delivered</span>
                            </button>
                          </div>
                        )}

                        {ord.status === "out_for_delivery" && (
                          <button
                            type="button"
                            onClick={() =>
                              handleOrderStatusChange(ord.id, "delivered")
                            }
                            className="w-full min-h-[44px] rounded-xs bg-status-open text-text-onSecondary font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Mark Delivered</span>
                          </button>
                        )}

                        {/* Print KOT & Track Links */}
                        <div className="flex items-center justify-between pt-1">
                          <button
                            type="button"
                            onClick={() => handlePrintKot(ord)}
                            className="min-h-[36px] px-3 rounded-xs bg-surface-raised hover:bg-border-subtle text-text-primary text-xs font-extrabold inline-flex items-center gap-1.5"
                          >
                            <Printer className="w-3.5 h-3.5 text-brand-secondary" />
                            <span>Print KOT (58/80mm)</span>
                          </button>
                          <Link
                            href={`/track/${ord.id}`}
                            className="text-xs font-extrabold text-brand-secondary underline"
                          >
                            Customer Track View →
                          </Link>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* SCREEN 2: MENU MANAGER (INSTANT STOCK TOGGLE & PRICE EDIT) */}
        {activeScreen === "menu" && (
          <div className="space-y-6">
            <div className="p-4 rounded-md bg-surface-base border border-border-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h1 className="text-base sm:text-lg font-extrabold">
                  Menu & Instant Stock Manager
                </h1>
                <p className="text-xs text-text-secondary">
                  Toggling an item Out of Stock updates the customer ordering
                  page within 2 seconds.
                </p>
              </div>
              <span className="px-3 py-1 rounded-pill bg-brand-primarySoft text-text-primary text-xs font-extrabold">
                {items.filter((i) => i.is_available).length} / {items.length}{" "}
                Items In Stock
              </span>
            </div>

            {categories.map((cat) => {
              const catItems = items.filter((i) => i.category_id === cat.id);
              const allInStock = catItems.every((i) => i.is_available);

              return (
                <section
                  key={cat.id}
                  className="rounded-md bg-surface-base border border-border-subtle overflow-hidden shadow-card"
                >
                  <div className="bg-brand-secondary text-text-onSecondary px-4 py-3 flex items-center justify-between">
                    <h2 className="text-sm font-extrabold uppercase tracking-wide">
                      {cat.name} ({catItems.length})
                    </h2>
                    <button
                      type="button"
                      onClick={() =>
                        handleToggleCategoryStock(cat.id, !allInStock)
                      }
                      className="px-3 py-1 rounded-xs bg-brand-primary text-text-onPrimary text-xs font-extrabold"
                    >
                      {allInStock
                        ? "Mark Category Out of Stock"
                        : "Mark All In Stock"}
                    </button>
                  </div>

                  <div className="divide-y divide-border-subtle">
                    {catItems.map((item) => (
                      <div
                        key={item.id}
                        className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3">
                          <DietBadge diet={item.diet} size="sm" />
                          <div>
                            <p className="text-sm font-extrabold text-text-primary">
                              {item.name}
                            </p>
                            <p className="text-xs text-text-secondary">
                              Current Price: ₹{item.price}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 self-end sm:self-center">
                          {/* Quick Price Edit */}
                          <div className="flex items-center border border-border-muted rounded-xs overflow-hidden h-9">
                            <span className="px-2 bg-surface-raised text-xs font-bold text-text-secondary">
                              ₹
                            </span>
                            <input
                              type="number"
                              defaultValue={item.price}
                              onBlur={(e) =>
                                handleUpdateItemPrice(
                                  item.id,
                                  Number(e.target.value)
                                )
                              }
                              aria-label={`Price for ${item.name}`}
                              className="w-20 px-2 text-xs font-extrabold text-text-primary focus:outline-none"
                            />
                          </div>

                          {/* Stock Toggle Switch */}
                          <button
                            type="button"
                            role="switch"
                            aria-checked={item.is_available}
                            onClick={() =>
                              handleToggleItemStock(item.id, !item.is_available)
                            }
                            className={`min-h-[40px] px-4 rounded-xs font-extrabold text-xs transition duration-fast ${
                              item.is_available
                                ? "bg-status-open text-text-onSecondary"
                                : "bg-status-error text-text-onSecondary"
                            }`}
                          >
                            {item.is_available ? "IN STOCK" : "OUT OF STOCK"}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}

        {/* SCREEN 3: STORE CONTROLS */}
        {activeScreen === "controls" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <section className="rounded-md bg-surface-base border border-border-subtle p-5 shadow-card space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-extrabold">
                    Outlet Status (Open / Close)
                  </h2>
                  <p className="text-xs text-text-secondary">
                    Immediately open or close {outlet.name} for online orders
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    handleUpdateOutletControls({ is_open: !outlet.is_open })
                  }
                  className={`min-h-[44px] px-5 rounded-xs font-extrabold text-xs inline-flex items-center gap-2 ${
                    outlet.is_open
                      ? "bg-status-open text-text-onSecondary"
                      : "bg-status-error text-text-onSecondary"
                  }`}
                >
                  <Power className="w-4 h-4" />
                  <span>{outlet.is_open ? "STORE OPEN" : "STORE CLOSED"}</span>
                </button>
              </div>

              <div className="pt-3 border-t border-border-subtle space-y-2">
                <p className="text-xs font-extrabold uppercase text-text-secondary">
                  Quick Pause Orders (Busy Kitchen)
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      handleUpdateOutletControls({ pause_minutes: 30 })
                    }
                    className="min-h-[40px] px-3.5 rounded-xs bg-surface-raised border border-border-muted text-xs font-bold hover:bg-brand-primarySoft"
                  >
                    Pause for 30 Mins
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handleUpdateOutletControls({ pause_minutes: 60 })
                    }
                    className="min-h-[40px] px-3.5 rounded-xs bg-surface-raised border border-border-muted text-xs font-bold hover:bg-brand-primarySoft"
                  >
                    Pause for 60 Mins
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handleUpdateOutletControls({ pause_minutes: 0 })
                    }
                    className="min-h-[40px] px-3.5 rounded-xs bg-brand-primary text-text-onPrimary text-xs font-extrabold"
                  >
                    Resume Accepting Orders
                  </button>
                </div>
              </div>
            </section>

            <section className="rounded-md bg-surface-base border border-border-subtle p-5 shadow-card space-y-4">
              <h2 className="text-base font-extrabold">
                Preparation Time & Delivery Mode
              </h2>
              <div className="space-y-2">
                <p className="text-xs font-bold text-text-secondary">
                  Default Kitchen Prep Time: {outlet.prep_time_min} Mins
                </p>
                <div className="flex items-center gap-2">
                  {[15, 25, 35, 45].map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() =>
                        handleUpdateOutletControls({ prep_time_min: mins })
                      }
                      className={`min-h-[40px] px-4 rounded-xs text-xs font-extrabold border ${
                        outlet.prep_time_min === mins
                          ? "bg-brand-secondary text-text-onSecondary border-brand-secondary"
                          : "bg-surface-base text-text-primary border-border-muted"
                      }`}
                    >
                      {mins} Mins
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-border-subtle flex items-center justify-between">
                <div>
                  <p className="text-xs font-extrabold">Home Delivery Service</p>
                  <p className="text-[11px] text-text-secondary">
                    5.0 km radius around Vinay Nagar, Gwalior
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    handleUpdateOutletControls({
                      delivery_enabled: !(outlet.delivery_enabled ?? true),
                    })
                  }
                  className={`min-h-[40px] px-4 rounded-xs text-xs font-extrabold ${
                    outlet.delivery_enabled !== false
                      ? "bg-brand-secondary text-text-onSecondary"
                      : "bg-surface-raised text-text-muted border border-border-muted"
                  }`}
                >
                  {outlet.delivery_enabled !== false
                    ? "Delivery ON"
                    : "Delivery OFF"}
                </button>
              </div>
            </section>
          </div>
        )}

        {/* SCREEN 4: BASIC REPORTS & CSV EXPORT */}
        {activeScreen === "reports" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <h1 className="text-base sm:text-lg font-extrabold">
                Today&apos;s Outlet Performance & Reports
              </h1>
              <button
                type="button"
                onClick={handleExportCsv}
                className="min-h-[44px] px-4 py-2 rounded-xs bg-brand-primary hover:bg-brand-primaryHover text-text-onPrimary font-extrabold text-xs inline-flex items-center gap-2 shadow-1"
              >
                <Download className="w-4 h-4" />
                <span>Export Orders CSV</span>
              </button>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-md bg-surface-base border border-border-subtle shadow-card">
                <p className="text-xs font-bold text-text-secondary">
                  Total Orders
                </p>
                <p className="text-2xl font-extrabold text-text-primary mt-1">
                  {orders.length}
                </p>
              </div>
              <div className="p-4 rounded-md bg-surface-base border border-border-subtle shadow-card">
                <p className="text-xs font-bold text-text-secondary">
                  Net Revenue
                </p>
                <p className="text-2xl font-extrabold text-brand-secondary mt-1">
                  ₹{totalRevenue}
                </p>
              </div>
              <div className="p-4 rounded-md bg-surface-base border border-border-subtle shadow-card">
                <p className="text-xs font-bold text-text-secondary">
                  Active In-Stock Items
                </p>
                <p className="text-2xl font-extrabold text-status-open mt-1">
                  {items.filter((i) => i.is_available).length} / {items.length}
                </p>
              </div>
              <div className="p-4 rounded-md bg-surface-base border border-border-subtle shadow-card">
                <p className="text-xs font-bold text-text-secondary">
                  Rejection / Cancel Rate
                </p>
                <p className="text-2xl font-extrabold text-text-primary mt-1">
                  {orders.length > 0
                    ? Math.round(
                        (orders.filter(
                          (o) =>
                            o.status === "rejected" || o.status === "cancelled"
                        ).length /
                          orders.length) *
                          100
                      )
                    : 0}
                  %
                </p>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Printable 58mm/80mm Kitchen Order Ticket (KOT) */}
      {printingOrder && (
        <div className="hidden print:block p-4 font-mono text-xs text-text-primary max-w-[300px] mx-auto">
          <div className="text-center border-b border-dashed border-text-primary pb-2 mb-2">
            <p className="text-sm font-extrabold">BURGER BUDDS — KOT</p>
            <p>{outlet.area}</p>
            <p className="font-bold mt-1">
              Order: #{printingOrder.order_no} (
              {printingOrder.order_type.toUpperCase()})
            </p>
            <p>{new Date(printingOrder.placed_at).toLocaleString()}</p>
          </div>
          <div className="space-y-1 border-b border-dashed border-text-primary pb-2 mb-2">
            {printingOrder.items.map((it) => (
              <div key={it.id} className="flex justify-between">
                <span>
                  {it.qty}x {it.item_name}
                  {it.variant ? ` (${it.variant})` : ""}
                </span>
                <span>₹{it.unit_price * it.qty}</span>
              </div>
            ))}
          </div>
          {printingOrder.special_instructions && (
            <p className="font-bold mb-2">
              NOTE: {printingOrder.special_instructions}
            </p>
          )}
          <div className="flex justify-between font-extrabold">
            <span>TOTAL ({printingOrder.payment_method.toUpperCase()})</span>
            <span>₹{printingOrder.grand_total}</span>
          </div>
        </div>
      )}
    </div>
  );
}
