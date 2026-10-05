"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  Banknote,
  Check,
  Coins,
  CreditCard,
  Loader2,
  MapPin,
  MessageSquarePlus,
  Plus,
  ShoppingBag,
  Sparkles,
  Tag,
} from "lucide-react";
import { GlobalHeader } from "@/components/layout/GlobalHeader";
import { GlobalFooter } from "@/components/layout/GlobalFooter";
import { DietBadge } from "@/components/ui/DietBadge";
import { useApp } from "@/context/AppContext";
import {
  DEFAULT_OUTLET_SLUG,
  SEED_COUPONS,
  SEED_ITEMS,
  SEED_OUTLET,
} from "@/lib/seed-data";
import {
  BillBreakdown,
  Coupon,
  MenuItem,
  PaymentMethod,
} from "@/types/database";

export default function CheckoutPage() {
  const router = useRouter();
  const {
    orderType,
    setOrderType,
    cartItems,
    updateLineQty,
    updateSimpleItemQty,
    clearCart,
    cartSubtotal,
    specialInstructions,
    setSpecialInstructions,
    couponCode,
    setCouponCode,
    useWallet,
    setUseWallet,
    marketingOptIn,
    setMarketingOptIn,
    user,
    openAuthModal,
    selectedAddress,
    openAddressModal,
    notifyRealtimeUpdate,
  } = useApp();

  const [menuItems, setMenuItems] = useState<MenuItem[]>(SEED_ITEMS);
  const [coupons, setCoupons] = useState<Coupon[]>(SEED_COUPONS);
  const [showInstructionsBox, setShowInstructionsBox] = useState<boolean>(
    Boolean(specialInstructions)
  );
  const [showAllCoupons, setShowAllCoupons] = useState<boolean>(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cod");
  const [pickupPhone, setPickupPhone] = useState("");
  const requestIdentity = useRef<{ signature: string; key: string } | null>(null);

  const [bill, setBill] = useState<BillBreakdown | null>(null);
  const [loadingBill, setLoadingBill] = useState<boolean>(false);
  const [placingOrder, setPlacingOrder] = useState<boolean>(false);
  const [orderError, setOrderError] = useState<string | null>(null);

  // Fetch live menu & coupons
  useEffect(() => {
    fetch(`/api/menu?outlet=${DEFAULT_OUTLET_SLUG}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.items)) setMenuItems(data.items);
        if (Array.isArray(data.coupons)) setCoupons(data.coupons);
      })
      .catch(() => {});
  }, []);

  // Recompute server-side bill whenever cart/coupon/wallet/address/orderType changes
  const fetchServerBill = useCallback(async () => {
    if (cartItems.length === 0) {
      setBill(null);
      return;
    }
    setLoadingBill(true);
    try {
      const payload = {
        outletSlug: DEFAULT_OUTLET_SLUG,
        orderType,
        couponCode,
        useWallet,
        walletBalance: user?.wallet_balance ?? 150,
        distanceKm: selectedAddress?.distance_km ?? 1.5,
        items: cartItems.map((line) => ({
          itemId: line.itemId,
          variantId: line.variant?.id || null,
          addonIds: line.addons.map((a) => a.id),
          qty: line.qty,
        })),
      };
      const res = await fetch("/api/cart/price", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data: BillBreakdown = await res.json();
        setBill(data);
      }
    } catch {
      // Fallback handled by memo
    } finally {
      setLoadingBill(false);
    }
  }, [
    cartItems,
    orderType,
    couponCode,
    useWallet,
    user?.wallet_balance,
    selectedAddress?.distance_km,
  ]);

  useEffect(() => {
    fetchServerBill();
  }, [fetchServerBill]);

  // Upsell items ("Craving More?" carousel — items not yet in cart)
  const upsellItems = useMemo(() => {
    const inCartIds = new Set(cartItems.map((c) => c.itemId));
    return menuItems.filter((m) => m.is_available && !inCartIds.has(m.id));
  }, [menuItems, cartItems]);

  const handlePlaceOrder = async () => {
    setOrderError(null);

    if (orderType === "delivery" && !selectedAddress) {
      openAddressModal();
      return;
    }

    if (!user) {
      openAuthModal(() => {
        // User logged in via OTP modal
      });
      return;
    }
    if (orderType === "takeaway" && !/^[6-9]\d{9}$/.test(pickupPhone)) {
      setOrderError("Please enter your 10-digit mobile number for pickup updates."); return;
    }

    setPlacingOrder(true);
    try {
      const signature = JSON.stringify({ user: user.id, cartItems, selectedAddress, orderType, couponCode, specialInstructions, pickupPhone });
      if (requestIdentity.current?.signature !== signature) requestIdentity.current = { signature, key: crypto.randomUUID() };
      const idempotencyKey = requestIdentity.current.key;
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idempotencyKey,
          outletSlug: DEFAULT_OUTLET_SLUG,
          userId: user.id,
          customerName: user.name,
          customerPhone: orderType === "takeaway" ? pickupPhone : selectedAddress?.phone,
          orderType,
          address: orderType === "delivery" ? selectedAddress : null,
          couponCode,
          useWallet,
          walletBalance: user.wallet_balance,
          paymentMethod,
          specialInstructions,
          marketingOptIn,
          items: cartItems.map((line) => ({
            itemId: line.itemId,
            variantId: line.variant?.id || null,
            addonIds: line.addons.map((a) => a.id),
            qty: line.qty,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setOrderError(data.error || "Could not place order. Please try again.");
        setPlacingOrder(false);
        return;
      }

      // Broadcast to Merchant App (/merchant) in real time!
      notifyRealtimeUpdate("order_created", data.order);
      clearCart();
      router.push(`/track/${data.order.id}`);
    } catch {
      setOrderError("Network error while placing your order. Please retry.");
      setPlacingOrder(false);
    }
  };

  const grandTotal = bill ? bill.grandTotal : cartSubtotal;
  const walletBalance = user?.wallet_balance ?? 150;

  return (
    <div className="min-h-screen flex flex-col bg-surface-page text-text-primary">
      <GlobalHeader totalMenuItems={menuItems.length} />

      <main className="flex-1 max-w-6xl w-full mx-auto px-3 sm:px-6 pt-5 pb-28">
        {/* Top Back Link */}
        <div className="mb-4 flex items-center justify-between">
          <Link
            href={`/order/${DEFAULT_OUTLET_SLUG}`}
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-extrabold text-brand-secondary hover:underline"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to {SEED_OUTLET.name} Menu</span>
          </Link>

          <div className="inline-flex rounded-xs border border-border-muted bg-surface-base p-0.5">
            <button
              type="button"
              onClick={() => setOrderType("delivery")}
              className={`px-3 py-1 rounded-xs text-xs font-extrabold transition duration-fast ${
                orderType === "delivery"
                  ? "bg-brand-secondary text-text-onSecondary"
                  : "text-text-secondary"
              }`}
            >
              Delivery
            </button>
            <button
              type="button"
              onClick={() => setOrderType("takeaway")}
              className={`px-3 py-1 rounded-xs text-xs font-extrabold transition duration-fast ${
                orderType === "takeaway"
                  ? "bg-brand-secondary text-text-onSecondary"
                  : "text-text-secondary"
              }`}
            >
              Takeaway
            </button>
          </div>
        </div>

        {cartItems.length === 0 ? (
          <div className="p-10 rounded-md bg-surface-base border border-border-subtle text-center space-y-4 shadow-card max-w-lg mx-auto my-8">
            <div className="w-14 h-14 rounded-pill bg-brand-primarySoft text-text-primary mx-auto flex items-center justify-center">
              <ShoppingBag className="w-7 h-7" />
            </div>
            <h1 className="text-lg font-extrabold">Your Cart is Empty</h1>
            <p className="text-xs sm:text-sm text-text-secondary">
              Looks like you haven&apos;t added any smash burgers or peri-peri
              fries yet!
            </p>
            <Link
              href={`/order/${DEFAULT_OUTLET_SLUG}`}
              className="min-h-[44px] px-6 py-2.5 rounded-xs bg-brand-primary hover:bg-brand-primaryHover text-text-onPrimary font-extrabold text-sm inline-flex items-center gap-2 shadow-1"
            >
              <span>Browse Burger Budds Menu</span>
            </Link>
          </div>
        ) : (
          /* Desktop: Two Columns (Left: Items/Upsell/Savings, Right: Delivery + Bill + CTA) */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* LEFT COLUMN */}
            <div className="lg:col-span-7 space-y-5">
              {/* SECTION 1: Items Added */}
              <section
                aria-labelledby="checkout-items-heading"
                className="rounded-md bg-surface-base border border-border-subtle p-4 sm:p-5 shadow-card space-y-4"
              >
                <div className="flex items-center justify-between border-b border-border-subtle pb-3">
                  <h1
                    id="checkout-items-heading"
                    className="text-base sm:text-lg font-extrabold uppercase tracking-wide"
                  >
                    1. Items Added ({cartItems.reduce((s, i) => s + i.qty, 0)})
                  </h1>
                  <span className="text-xs font-bold text-brand-secondary">
                    {SEED_OUTLET.area}
                  </span>
                </div>

                <div className="divide-y divide-border-subtle">
                  {cartItems.map((line) => {
                    const variantExtra = line.variant?.price_delta || 0;
                    const addonsExtra = line.addons.reduce(
                      (s, a) => s + a.price,
                      0
                    );
                    const unitPrice =
                      line.basePrice + variantExtra + addonsExtra;
                    const lineTotal = unitPrice * line.qty;

                    return (
                      <div
                        key={line.cartItemId}
                        className="py-3.5 flex items-start justify-between gap-3"
                      >
                        <div className="flex items-start gap-2.5 min-w-0">
                          <div className="mt-0.5">
                            <DietBadge diet={line.diet} size="sm" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-extrabold text-text-primary">
                              {line.name}
                            </p>
                            {line.variant && (
                              <p className="text-xs font-semibold text-text-secondary">
                                Size: {line.variant.name}
                              </p>
                            )}
                            {line.addons.length > 0 && (
                              <p className="text-xs text-text-muted">
                                Add-ons:{" "}
                                {line.addons.map((a) => a.name).join(", ")}
                              </p>
                            )}
                            <p className="text-xs font-bold text-text-secondary mt-0.5">
                              ₹{unitPrice} each
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          {/* Yellow Stepper */}
                          <div className="h-9 rounded-xs bg-brand-primary text-text-onPrimary font-extrabold text-xs flex items-center border border-text-primary/15 shadow-1">
                            <button
                              type="button"
                              onClick={() =>
                                updateLineQty(line.cartItemId, -1)
                              }
                              aria-label={`Decrease quantity of ${line.name}`}
                              className="w-8 h-full flex items-center justify-center text-sm hover:bg-brand-primaryHover"
                            >
                              −
                            </button>
                            <span className="px-2 font-extrabold">
                              {line.qty}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                updateLineQty(line.cartItemId, 1)
                              }
                              aria-label={`Increase quantity of ${line.name}`}
                              className="w-8 h-full flex items-center justify-center text-sm hover:bg-brand-primaryHover"
                            >
                              +
                            </button>
                          </div>

                          <span className="w-16 text-right text-sm font-extrabold text-text-primary">
                            ₹{lineTotal}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Action Buttons: "Add More Items" + "Add Special Instructions" */}
                <div className="pt-2 flex flex-wrap items-center gap-3 border-t border-border-subtle">
                  <Link
                    href={`/order/${DEFAULT_OUTLET_SLUG}`}
                    className="min-h-[40px] px-3.5 py-2 rounded-xs bg-surface-raised hover:bg-brand-secondarySoft text-brand-secondary font-extrabold text-xs inline-flex items-center gap-1.5 border border-border-muted transition duration-fast"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add More Items</span>
                  </Link>

                  <button
                    type="button"
                    onClick={() => setShowInstructionsBox((p) => !p)}
                    className="min-h-[40px] px-3.5 py-2 rounded-xs bg-surface-raised hover:bg-brand-primarySoft text-text-primary font-extrabold text-xs inline-flex items-center gap-1.5 border border-border-muted transition duration-fast"
                  >
                    <MessageSquarePlus className="w-3.5 h-3.5 text-brand-secondary" />
                    <span>Add Special Instructions</span>
                  </button>
                </div>

                {showInstructionsBox && (
                  <div className="pt-1">
                    <label
                      htmlFor="cooking-instructions"
                      className="block text-xs font-bold text-text-secondary mb-1"
                    >
                      Cooking / Delivery Note for Burger Budds Kitchen
                    </label>
                    <textarea
                      id="cooking-instructions"
                      rows={2}
                      value={specialInstructions}
                      onChange={(e) => setSpecialInstructions(e.target.value)}
                      placeholder="e.g. Make burger extra spicy, no raw onions, send extra peri-peri seasoning..."
                      className="w-full p-3 rounded-xs border border-border-muted text-xs font-medium text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-secondary"
                    />
                  </div>
                )}
              </section>

              {/* SECTION 2: Craving More? (Horizontal Carousel of Upsell Items with + Button) */}
              {upsellItems.length > 0 && (
                <section
                  aria-labelledby="craving-more-heading"
                  className="rounded-md bg-surface-base border border-border-subtle p-4 sm:p-5 shadow-card space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <h2
                      id="craving-more-heading"
                      className="text-sm sm:text-base font-extrabold uppercase tracking-wide flex items-center gap-1.5"
                    >
                      <Sparkles className="w-4 h-4 text-brand-secondary" />
                      <span>2. Craving More?</span>
                    </h2>
                    <span className="text-xs font-semibold text-text-muted">
                      Complete your meal
                    </span>
                  </div>

                  <div className="flex items-stretch gap-3 overflow-x-auto pb-2">
                    {upsellItems.slice(0, 6).map((up) => (
                      <div
                        key={up.id}
                        className="w-44 shrink-0 rounded-sm border border-border-subtle bg-surface-raised p-2.5 flex flex-col justify-between gap-2"
                      >
                        <div>
                          <div className="relative h-24 w-full rounded-xs overflow-hidden bg-surface-base mb-2">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={up.image_url}
                              alt={up.name}
                              className="w-full h-full object-cover"
                            />
                            <span className="absolute top-1.5 left-1.5 bg-surface-base/90 p-0.5 rounded-xs">
                              <DietBadge diet={up.diet} size="sm" />
                            </span>
                          </div>
                          <p className="text-xs font-extrabold text-text-primary line-clamp-2">
                            {up.name}
                          </p>
                        </div>

                        <div className="flex items-center justify-between pt-1">
                          <span className="text-xs font-extrabold text-text-primary">
                            ₹{up.price}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateSimpleItemQty(up, 1)}
                            aria-label={`Add ${up.name} to cart`}
                            className="min-h-[34px] px-2.5 rounded-xs bg-brand-primary hover:bg-brand-primaryHover text-text-onPrimary font-extrabold text-xs inline-flex items-center gap-1 shadow-1"
                          >
                            <span>+</span>
                            <span>Add</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* SECTION 3: Savings Corner (Coupons with Apply/Min-Order Hint + View All Offers + BB Coins Wallet) */}
              <section
                aria-labelledby="savings-corner-heading"
                className="rounded-md bg-surface-base border border-border-subtle p-4 sm:p-5 shadow-card space-y-4"
              >
                <div className="flex items-center justify-between">
                  <h2
                    id="savings-corner-heading"
                    className="text-sm sm:text-base font-extrabold uppercase tracking-wide flex items-center gap-1.5"
                  >
                    <Tag className="w-4 h-4 text-brand-secondary" />
                    <span>3. Savings Corner</span>
                  </h2>
                  <button
                    type="button"
                    onClick={() => setShowAllCoupons((p) => !p)}
                    className="text-xs font-extrabold text-brand-secondary underline"
                  >
                    {showAllCoupons ? "Show Less" : "View All Offers"}
                  </button>
                </div>

                {/* Coupons List */}
                <div className="space-y-2.5">
                  {(showAllCoupons ? coupons : coupons.slice(0, 2)).map(
                    (coupon) => {
                      const shortfall = Math.max(
                        0,
                        Math.ceil(coupon.min_order - cartSubtotal)
                      );
                      const canApply = shortfall === 0;
                      const isApplied = couponCode === coupon.code;

                      return (
                        <div
                          key={coupon.id}
                          className={`p-3.5 rounded-xs border flex items-center justify-between gap-3 ${
                            isApplied
                              ? "border-status-open bg-status-openSoft/50"
                              : "border-border-subtle bg-surface-raised"
                          }`}
                        >
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded-xs bg-brand-primary text-text-onPrimary text-xs font-extrabold">
                                {coupon.code}
                              </span>
                              <span className="text-xs font-extrabold text-text-primary">
                                {coupon.title}
                              </span>
                            </div>
                            <p className="text-[11px] font-medium text-text-secondary">
                              {canApply
                                ? coupon.description
                                : `Add items worth ₹${shortfall} more to apply`}
                            </p>
                          </div>

                          {isApplied ? (
                            <button
                              type="button"
                              onClick={() => setCouponCode(null)}
                              className="min-h-[38px] px-3 rounded-xs bg-status-open text-text-onSecondary text-xs font-extrabold shrink-0"
                            >
                              Applied ✓ (Remove)
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={!canApply}
                              onClick={() => setCouponCode(coupon.code)}
                              className="min-h-[38px] px-4 rounded-xs bg-brand-primary hover:bg-brand-primaryHover disabled:bg-surface-base disabled:text-text-muted disabled:border disabled:border-border-muted text-text-onPrimary text-xs font-extrabold shrink-0 transition duration-fast"
                            >
                              Apply
                            </button>
                          )}
                        </div>
                      );
                    }
                  )}
                </div>

                {/* Wallet Row: "Available BB Coins: 150 — Use Wallet Balance" */}
                <label className="p-3.5 rounded-xs bg-brand-primarySoft border border-brand-primary flex items-center justify-between gap-3 cursor-pointer">
                  <div className="flex items-center gap-2.5">
                    <Coins className="w-5 h-5 text-brand-secondary shrink-0" />
                    <div>
                      <p className="text-xs sm:text-sm font-extrabold text-text-primary">
                        BB Coins — Coming soon
                      </p>
                      <p className="text-[11px] font-medium text-text-secondary">
                        Rewards will be available in a future update
                      </p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    disabled
                    checked={useWallet}
                    onChange={(e) => setUseWallet(e.target.checked)}
                    className="w-5 h-5 accent-brand-secondary cursor-pointer"
                  />
                </label>
              </section>
            </div>

            {/* RIGHT COLUMN: Delivery Details + Bill Details + Marketing Opt-in + Sticky CTA */}
            <div className="lg:col-span-5 space-y-5 lg:sticky lg:top-20">
              {/* SECTION 4: Delivery Details */}
              <section
                aria-labelledby="delivery-details-heading"
                className="rounded-md bg-surface-base border border-border-subtle p-4 sm:p-5 shadow-card space-y-3"
              >
                <div className="flex items-center justify-between">
                  <h2
                    id="delivery-details-heading"
                    className="text-sm sm:text-base font-extrabold uppercase tracking-wide flex items-center gap-1.5"
                  >
                    <MapPin className="w-4 h-4 text-brand-secondary" />
                    <span>
                      4.{" "}
                      {orderType === "delivery"
                        ? "Delivery Details"
                        : "Takeaway Pickup Details"}
                    </span>
                  </h2>
                  {orderType === "delivery" && (
                    <button
                      type="button"
                      onClick={openAddressModal}
                      className="text-xs font-extrabold text-brand-secondary underline"
                    >
                      {selectedAddress ? "Change" : "Select Address"}
                    </button>
                  )}
                </div>

                {orderType === "takeaway" ? (
                  <div className="p-3.5 rounded-xs bg-surface-raised border border-border-subtle text-xs space-y-1">
                    <p className="font-extrabold text-text-primary">
                      Self Pickup at {SEED_OUTLET.name}
                    </p>
                    <p className="text-text-secondary">{SEED_OUTLET.address}</p>
                    <label htmlFor="pickup-phone" className="block font-bold pt-2">Mobile number for pickup updates</label>
                    <input id="pickup-phone" type="tel" autoComplete="tel-national" inputMode="numeric" maxLength={10} value={pickupPhone} onChange={(event) => setPickupPhone(event.target.value.replace(/\D/g, "").slice(0, 10))} className="w-full min-h-[44px] rounded-xs border border-border-muted px-3 text-sm" placeholder="10-digit mobile number" />
                    <p className="font-bold text-status-open">
                      Zero Delivery Fee • Ready in ~{SEED_OUTLET.prep_time_min}{" "}
                      Mins
                    </p>
                  </div>
                ) : selectedAddress ? (
                  <div className="p-3.5 rounded-xs bg-brand-secondarySoft/40 border border-brand-secondary/30 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-pill bg-brand-secondary text-text-onSecondary text-[10px] font-extrabold uppercase">
                        {selectedAddress.label}
                      </span>
                      <span className="text-xs font-extrabold text-text-primary">
                        {selectedAddress.locality}, {selectedAddress.city}
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-text-secondary">
                      {selectedAddress.house}
                      {selectedAddress.landmark
                        ? `, ${selectedAddress.landmark}`
                        : ""}
                    </p>
                    <p className="text-[11px] font-bold text-text-muted">
                      Phone: {selectedAddress.phone}
                    </p>
                  </div>
                ) : (
                  <div className="p-4 rounded-xs bg-surface-raised border border-dashed border-border-muted text-center space-y-2">
                    <p className="text-xs font-bold text-text-secondary">
                      No delivery address selected yet.
                    </p>
                    <button
                      type="button"
                      onClick={openAddressModal}
                      className="min-h-[40px] px-4 py-2 rounded-xs bg-brand-primary text-text-onPrimary font-extrabold text-xs shadow-1"
                    >
                      Select Delivery Address
                    </button>
                  </div>
                )}
              </section>

              {/* SECTION 5: Bill Details (Item Total, GST 5%, Delivery Fee, Platform Fee, Discount, Grand Total) */}
              <section
                aria-labelledby="bill-details-heading"
                className="rounded-md bg-surface-base border border-border-subtle p-4 sm:p-5 shadow-card space-y-3"
              >
                <div className="flex items-center justify-between border-b border-border-subtle pb-2.5">
                  <h2
                    id="bill-details-heading"
                    className="text-sm sm:text-base font-extrabold uppercase tracking-wide"
                  >
                    5. Bill Details
                  </h2>
                  {loadingBill && (
                    <Loader2 className="w-4 h-4 animate-spin text-brand-secondary" />
                  )}
                </div>

                <div className="space-y-2 text-xs sm:text-sm font-semibold text-text-secondary">
                  <div className="flex justify-between">
                    <span>Item Total</span>
                    <span className="font-bold text-text-primary">
                      ₹{bill?.itemTotal ?? cartSubtotal}
                    </span>
                  </div>

                  {bill && bill.discount > 0 && (
                    <div className="flex justify-between text-status-open font-bold">
                      <span>Coupon Discount ({bill.couponCode})</span>
                      <span>− ₹{bill.discount}</span>
                    </div>
                  )}

                  <div className="flex justify-between">
                    <span>GST ({bill?.gstPercent ?? 5}%)</span>
                    <span className="font-bold text-text-primary">
                      ₹{bill?.tax ?? Math.round(cartSubtotal * 0.05)}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span>
                      Delivery Fee{" "}
                      {orderType === "delivery" && cartSubtotal >= 299
                        ? "(Free above ₹299)"
                        : ""}
                    </span>
                    <span className="font-bold text-text-primary">
                      {bill?.deliveryFee === 0 ? (
                        <span className="text-status-open font-extrabold">
                          FREE
                        </span>
                      ) : (
                        `₹${bill?.deliveryFee ?? 29}`
                      )}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span>Platform Fee</span>
                    <span className="font-bold text-text-primary">
                      ₹{bill?.platformFee ?? 9}
                    </span>
                  </div>

                  {bill && bill.walletUsed > 0 && (
                    <div className="flex justify-between text-brand-secondary font-bold">
                      <span>BB Coins Wallet Used</span>
                      <span>− ₹{bill.walletUsed}</span>
                    </div>
                  )}

                  <div className="pt-2.5 border-t-2 border-border-subtle flex items-center justify-between text-base font-extrabold text-text-primary">
                    <span>Grand Total</span>
                    <span>₹{grandTotal}</span>
                  </div>
                </div>

                {/* Payment Method Selector */}
                <div className="pt-3 border-t border-border-subtle space-y-2">
                  <span className="block text-xs font-extrabold uppercase tracking-wider text-text-secondary">
                    Payment Method
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod("cod")}
                      className={`min-h-[44px] px-3 py-2 rounded-xs border text-xs font-extrabold flex items-center justify-center gap-1.5 transition duration-fast ${
                        paymentMethod === "cod"
                          ? "border-brand-secondary bg-brand-secondary text-text-onSecondary"
                          : "border-border-muted bg-surface-base text-text-primary"
                      }`}
                    >
                      <Banknote className="w-4 h-4" />
                      <span>Cash on Delivery</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod("razorpay")}
                      disabled
                      aria-label="Online payment coming soon"
                      className={`min-h-[44px] px-3 py-2 rounded-xs border text-xs font-extrabold flex items-center justify-center gap-1.5 transition duration-fast ${
                        paymentMethod === "razorpay"
                          ? "border-brand-secondary bg-brand-secondary text-text-onSecondary"
                          : "border-border-muted bg-surface-base text-text-primary"
                      }`}
                    >
                      <CreditCard className="w-4 h-4" />
                      <span>UPI / Card · Soon</span>
                    </button>
                  </div>
                </div>

                {/* SECTION 6: Marketing Opt-in Checkbox (Unchecked by default) */}
                <label className="pt-2 flex items-start gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={marketingOptIn}
                    onChange={(e) => setMarketingOptIn(e.target.checked)}
                    className="mt-0.5 w-4 h-4 accent-brand-secondary rounded-xs shrink-0"
                  />
                  <span className="text-xs font-medium text-text-secondary leading-snug">
                    Yes, I would like to receive updates and exclusive offers
                    from Burger Budds
                  </span>
                </label>

                {orderError && (
                  <div
                    role="alert"
                    className="p-3 rounded-xs bg-status-errorSoft border border-status-error text-status-error text-xs font-bold flex items-start gap-2"
                  >
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{orderError}</span>
                  </div>
                )}

                {/* SECTION 7: Sticky CTA ("Select Delivery Address" -> "Pay ₹X") */}
                <div className="pt-2">
                  {orderType === "delivery" && !selectedAddress ? (
                    <button
                      type="button"
                      onClick={openAddressModal}
                      className="w-full min-h-[50px] rounded-xs bg-brand-primary hover:bg-brand-primaryHover text-text-onPrimary font-extrabold text-sm sm:text-base flex items-center justify-center gap-2 shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary"
                    >
                      <MapPin className="w-5 h-5" />
                      <span>Select Delivery Address</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={placingOrder}
                      onClick={handlePlaceOrder}
                      className="w-full min-h-[50px] rounded-xs bg-brand-primary hover:bg-brand-primaryHover disabled:opacity-50 text-text-onPrimary font-extrabold text-sm sm:text-base flex items-center justify-center gap-2 shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary transition duration-fast"
                    >
                      {placingOrder ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          <span>Placing Your Burger Budds Order...</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-5 h-5" />
                          <span>
                            {user
                              ? `Pay ₹${grandTotal} (${
                                  paymentMethod === "cod"
                                    ? "Cash on Delivery"
                                    : "Online Pay"
                                })`
                              : `Login & Pay ₹${grandTotal}`}
                          </span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </section>
            </div>
          </div>
        )}
      </main>

      {/* Mobile Sticky Bottom CTA Bar */}
      {cartItems.length > 0 && (
        <div className="fixed bottom-0 inset-x-0 z-40 lg:hidden bg-surface-base border-t border-border-muted p-3 shadow-floating">
          {orderType === "delivery" && !selectedAddress ? (
            <button
              type="button"
              onClick={openAddressModal}
              className="w-full min-h-[48px] rounded-xs bg-brand-primary text-text-onPrimary font-extrabold text-sm flex items-center justify-center gap-2"
            >
              <MapPin className="w-4 h-4" />
              <span>Select Delivery Address</span>
            </button>
          ) : (
            <button
              type="button"
              disabled={placingOrder}
              onClick={handlePlaceOrder}
              className="w-full min-h-[48px] rounded-xs bg-brand-primary text-text-onPrimary font-extrabold text-sm flex items-center justify-between px-5"
            >
              <span>Total: ₹{grandTotal}</span>
              <span>
                {placingOrder
                  ? "Placing Order..."
                  : user
                  ? `Pay ₹${grandTotal} →`
                  : `Login & Pay ₹${grandTotal} →`}
              </span>
            </button>
          )}
        </div>
      )}

      <GlobalFooter />
    </div>
  );
}
