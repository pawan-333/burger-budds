"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Info,
  ListFilter,
  MapPin,
  Plus,
  Search,
  ShoppingBag,
  Sparkles,
  Tag,
  Utensils,
  X,
} from "lucide-react";
import {
  Category,
  Coupon,
  MenuItem,
  OrderType,
  Outlet,
} from "@/types/database";
import { DietBadge } from "@/components/ui/DietBadge";
import { MenuItemCard } from "@/components/menu/MenuItemCard";
import { ItemDetailModal } from "@/components/modals/ItemDetailModal";
import { GlobalHeader } from "@/components/layout/GlobalHeader";
import { GlobalFooter } from "@/components/layout/GlobalFooter";
import { useApp } from "@/context/AppContext";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

interface OrderMenuClientProps {
  initialOutlet: Outlet;
  initialCategories: Category[];
  initialItems: MenuItem[];
  initialCoupons: Coupon[];
}

export function OrderMenuClient({
  initialOutlet,
  initialCategories,
  initialItems,
  initialCoupons,
}: OrderMenuClientProps) {
  const {
    selectOutlet,
    cartId,
    orderType,
    setOrderType,
    totalItemsCount,
    cartSubtotal,
    couponCode,
    setCouponCode,
    selectedAddress,
    openAddressModal,
    searchQuery,
    setSearchQuery,
  } = useApp();

  useEffect(() => { selectOutlet(initialOutlet); }, [initialOutlet, selectOutlet]);
  const [outlet, setOutlet] = useState<Outlet>(initialOutlet);
  const [categories] = useState<Category[]>(initialCategories);
  const [items, setItems] = useState<MenuItem[]>(initialItems);
  const [coupons] = useState<Coupon[]>(initialCoupons);

  const [activeCategoryId, setActiveCategoryId] = useState<string>(
    initialCategories[0]?.id || ""
  );
  const [expandedSidebarCat, setExpandedSidebarCat] = useState<
    Record<string, boolean>
  >({});
  const [showOutletInfo, setShowOutletInfo] = useState<boolean>(false);
  const [showOffersDropdown, setShowOffersDropdown] = useState<boolean>(false);
  const [showMobileCategoryModal, setShowMobileCategoryModal] =
    useState<boolean>(false);
  const [selectedModalItem, setSelectedModalItem] = useState<MenuItem | null>(
    null
  );

  // Filter Chips State (In Stock default ON & removable per PLAN.md 4.2)
  const [inStockOnly, setInStockOnly] = useState<boolean>(true);
  const [selectedDiets, setSelectedDiets] = useState<
    Array<"veg" | "nonveg" | "egg">
  >([]);
  const [onOfferOnly, setOnOfferOnly] = useState<boolean>(false);
  const [rated4PlusOnly, setRated4PlusOnly] = useState<boolean>(false);
  const [highlyOrderedOnly, setHighlyOrderedOnly] = useState<boolean>(false);
  const [bestsellerOnly, setBestsellerOnly] = useState<boolean>(false);
  const [newOnly, setNewOnly] = useState<boolean>(false);

  // Refresh menu from server (for realtime stock & outlet open/close updates < 2 sec)
  const refreshLiveMenu = useCallback(async () => {
    try {
      const res = await fetch(`/api/menu?outlet=${outlet.slug}`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.outlet) setOutlet(data.outlet);
      if (Array.isArray(data.items)) setItems(data.items);
    } catch {
      // Ignore network hiccups
    }
  }, [outlet.slug]);

  useEffect(() => {
    // 1. BroadcastChannel listener for instant cross-tab merchant stock/store updates
    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel("burger-budds-realtime");
      channel.onmessage = (ev) => {
        if (ev.data?.type === "menu_updated") {
          refreshLiveMenu();
        }
      };
    } catch {
      // Ignore
    }

    // 2. Supabase Realtime listener when configured
    const sb = getSupabaseBrowserClient();
    const sub = sb
      ?.channel("public-menu-sync")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "items" },
        () => refreshLiveMenu()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "outlets" },
        () => refreshLiveMenu()
      )
      .subscribe();

    // 3. Lightweight 2s poll so any change in another window reflects within 2 sec
    const timer = setInterval(refreshLiveMenu, 2000);

    return () => {
      if (channel) channel.close();
      if (sub && sb) sb.removeChannel(sub);
      clearInterval(timer);
    };
  }, [refreshLiveMenu]);

  const toggleDietFilter = (diet: "veg" | "nonveg" | "egg") => {
    setSelectedDiets((prev) =>
      prev.includes(diet) ? prev.filter((d) => d !== diet) : [...prev, diet]
    );
  };

  const resetAllFilters = () => {
    setInStockOnly(false);
    setSelectedDiets([]);
    setOnOfferOnly(false);
    setRated4PlusOnly(false);
    setHighlyOrderedOnly(false);
    setBestsellerOnly(false);
    setNewOnly(false);
    setSearchQuery("");
  };

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (inStockOnly && !item.is_available) return false;
      if (selectedDiets.length > 0 && !selectedDiets.includes(item.diet))
        return false;
      if (onOfferOnly && !item.is_on_offer) return false;
      if (rated4PlusOnly && item.rating < 4.0) return false;
      if (highlyOrderedOnly && item.order_count < 300) return false;
      if (bestsellerOnly && !item.is_bestseller) return false;
      if (newOnly && !item.is_new) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = item.name.toLowerCase().includes(q);
        const matchDesc = item.description.toLowerCase().includes(q);
        if (!matchName && !matchDesc) return false;
      }
      return true;
    });
  }, [
    items,
    inStockOnly,
    selectedDiets,
    onOfferOnly,
    rated4PlusOnly,
    highlyOrderedOnly,
    bestsellerOnly,
    newOnly,
    searchQuery,
  ]);

  const activeFilterCount =
    (inStockOnly ? 1 : 0) +
    selectedDiets.length +
    (onOfferOnly ? 1 : 0) +
    (rated4PlusOnly ? 1 : 0) +
    (highlyOrderedOnly ? 1 : 0) +
    (bestsellerOnly ? 1 : 0) +
    (newOnly ? 1 : 0);

  const scrollToCategory = (catId: string) => {
    setActiveCategoryId(catId);
    setShowMobileCategoryModal(false);
    const el = document.getElementById(`cat-section-${catId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-surface-page text-text-primary">
      <GlobalHeader totalMenuItems={items.length} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 pt-4 pb-28">
        {/* 1. Outlet Header Bar */}
        <section
          aria-label="Outlet Information and Order Type"
          className="rounded-md bg-surface-base border border-border-subtle p-4 sm:p-5 shadow-card mb-4"
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center flex-wrap gap-2">
                <h1 className="text-lg sm:text-xl font-extrabold text-text-primary">
                  {outlet.name}
                </h1>
                <button
                  type="button"
                  onClick={() => setShowOutletInfo((p) => !p)}
                  aria-label="Outlet information and timings"
                  aria-expanded={showOutletInfo}
                  className="w-7 h-7 rounded-pill bg-surface-raised hover:bg-brand-secondarySoft text-brand-secondary inline-flex items-center justify-center border border-border-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary"
                >
                  <Info className="w-4 h-4" />
                </button>
                <span
                  className={`px-2.5 py-0.5 rounded-pill text-xs font-extrabold uppercase tracking-wider ${
                    outlet.is_open
                      ? "bg-status-open text-text-onSecondary"
                      : "bg-status-error text-text-onSecondary"
                  }`}
                >
                  {outlet.is_open ? "OPEN" : "CLOSED"}
                </span>
              </div>

              <div className="flex items-center flex-wrap gap-3 text-xs sm:text-sm font-semibold text-text-secondary">
                <span className="inline-flex items-center gap-1">
                  <MapPin className="w-4 h-4 text-brand-secondary" />
                  {outlet.area}
                </span>
                <span>•</span>
                <span className="inline-flex items-center gap-1">
                  <Clock className="w-4 h-4 text-brand-secondary" />
                  {outlet.prep_time_min + 10} Mins
                </span>
                {selectedAddress && (
                  <>
                    <span>•</span>
                    <button
                      type="button"
                      onClick={openAddressModal}
                      className="text-brand-secondary font-extrabold underline"
                    >
                      Delivering to {selectedAddress.locality}
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Order Type Dropdown (Delivery / Takeaway) */}
            <div className="flex items-center gap-3 self-start md:self-center">
              <label
                htmlFor="order-type-select"
                className="text-xs font-extrabold uppercase tracking-wider text-text-secondary"
              >
                Order Type:
              </label>
              <div className="relative">
                <select
                  id="order-type-select"
                  value={orderType}
                  onChange={(e) => setOrderType(e.target.value as OrderType)}
                  className="min-h-[44px] pl-3.5 pr-9 py-2 rounded-xs bg-brand-primary text-text-onPrimary font-extrabold text-xs sm:text-sm border border-text-primary/15 shadow-1 appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-text-primary"
                >
                  <option value="delivery">Delivery (Doorstep)</option>
                  <option value="takeaway">Takeaway (Self Pickup)</option>
                </select>
                <ChevronDown className="w-4 h-4 text-text-onPrimary absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Expandable Outlet Info Card */}
          {showOutletInfo && (
            <div className="mt-4 pt-3 border-t border-border-subtle grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-text-secondary bg-surface-raised p-3.5 rounded-xs">
              <div>
                <p className="font-extrabold text-text-primary">
                  Outlet Address
                </p>
                <p>{outlet.address}</p>
              </div>
              <div>
                <p className="font-extrabold text-text-primary">
                  Store Hours & Contact
                </p>
                <p>
                  {outlet.timings.open} – {outlet.timings.close} •{" "}
                  {outlet.phone}
                </p>
              </div>
              <div>
                <p className="font-extrabold text-text-primary">
                  Delivery Zone & Min Order
                </p>
                <p>
                  Within {outlet.delivery_radius_km} km radius • Min Order ₹
                  {outlet.min_order} • Free delivery above ₹
                  {outlet.delivery_fee_rules.free_above}
                </p>
              </div>
            </div>
          )}
        </section>

        {/* 2. Offers Strip ("ENJOY FLAT 129 on every order — Use code FLAT129" + "N OFFERS" dropdown) */}
        <section
          aria-label="Active Coupons and Offers"
          className="relative rounded-md bg-brand-secondary text-text-onSecondary p-3.5 sm:px-5 shadow-card mb-4"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="w-9 h-9 rounded-pill bg-brand-primary text-text-onPrimary font-extrabold flex items-center justify-center shrink-0 shadow-1">
                <Tag className="w-4 h-4" />
              </span>
              <div>
                <p className="text-sm sm:text-base font-extrabold tracking-tight">
                  ENJOY FLAT 129 on every order — Use code{" "}
                  <span className="px-2 py-0.5 rounded-xs bg-brand-primary text-text-onPrimary font-extrabold">
                    FLAT129
                  </span>
                </p>
                <p className="text-xs text-text-onSecondary/85">
                  Save flat ₹70 on orders above ₹199 + earn BB Coins on every
                  burger!
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-center">
              <button
                type="button"
                onClick={() => setCouponCode("FLAT129")}
                className="min-h-[40px] px-3.5 py-1.5 rounded-xs bg-brand-primary hover:bg-brand-primaryHover text-text-onPrimary font-extrabold text-xs inline-flex items-center gap-1 shadow-1"
              >
                {couponCode === "FLAT129" ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>FLAT129 Applied</span>
                  </>
                ) : (
                  <span>Apply FLAT129</span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setShowOffersDropdown((p) => !p)}
                aria-expanded={showOffersDropdown}
                className="min-h-[40px] px-3.5 py-1.5 rounded-xs bg-brand-secondaryDark hover:bg-surface-dark text-text-onSecondary font-extrabold text-xs inline-flex items-center gap-1.5 border border-text-onSecondary/20"
              >
                <span>{coupons.length} OFFERS</span>
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {showOffersDropdown && (
            <div className="mt-3 pt-3 border-t border-text-onSecondary/15 grid grid-cols-1 md:grid-cols-3 gap-3">
              {coupons.map((c) => {
                const isApplied = couponCode === c.code;
                return (
                  <div
                    key={c.id}
                    className="p-3 rounded-xs bg-surface-base text-text-primary flex flex-col justify-between gap-2 shadow-1"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="px-2 py-0.5 rounded-xs bg-brand-primary text-text-onPrimary text-xs font-extrabold">
                          {c.code}
                        </span>
                        <span className="text-[11px] font-bold text-text-muted">
                          Min order ₹{c.min_order}
                        </span>
                      </div>
                      <p className="text-xs font-extrabold mt-1.5">{c.title}</p>
                      <p className="text-[11px] text-text-secondary mt-0.5">
                        {c.description}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setCouponCode(c.code);
                        setShowOffersDropdown(false);
                      }}
                      className={`w-full min-h-[36px] rounded-xs text-xs font-extrabold transition duration-fast ${
                        isApplied
                          ? "bg-status-open text-text-onSecondary"
                          : "bg-brand-secondary text-text-onSecondary hover:bg-brand-secondaryDark"
                      }`}
                    >
                      {isApplied ? "✓ Applied to Cart" : `Use Code ${c.code}`}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* 3. Filter Chips Row (Horizontal Scroll) */}
        <section aria-label="Menu Filters" className="mb-5">
          <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
            {/* Filters Count / Reset Chip */}
            <button
              type="button"
              onClick={resetAllFilters}
              className={`min-h-[40px] px-3.5 py-1.5 rounded-pill text-xs font-extrabold inline-flex items-center gap-1.5 shrink-0 border transition duration-fast ${
                activeFilterCount > 0
                  ? "bg-surface-dark text-text-onSecondary border-surface-dark"
                  : "bg-surface-base text-text-primary border-border-muted"
              }`}
            >
              <ListFilter className="w-3.5 h-3.5" />
              <span>Filters</span>
              {activeFilterCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-pill bg-brand-primary text-text-onPrimary text-[10px]">
                  {activeFilterCount}
                </span>
              )}
            </button>

            {/* In Stock (Default ON, Removable) */}
            <button
              type="button"
              onClick={() => setInStockOnly((p) => !p)}
              aria-pressed={inStockOnly}
              className={`min-h-[40px] px-3.5 py-1.5 rounded-pill text-xs font-extrabold inline-flex items-center gap-1.5 shrink-0 border transition duration-fast ${
                inStockOnly
                  ? "bg-brand-secondary text-text-onSecondary border-brand-secondary"
                  : "bg-surface-base text-text-primary border-border-muted hover:bg-surface-raised"
              }`}
            >
              <span>In Stock</span>
              {inStockOnly && <X className="w-3.5 h-3.5" />}
            </button>

            {/* Veg */}
            <button
              type="button"
              onClick={() => toggleDietFilter("veg")}
              aria-pressed={selectedDiets.includes("veg")}
              className={`min-h-[40px] px-3.5 py-1.5 rounded-pill text-xs font-extrabold inline-flex items-center gap-1.5 shrink-0 border transition duration-fast ${
                selectedDiets.includes("veg")
                  ? "bg-brand-secondarySoft text-veg border-veg ring-1 ring-veg"
                  : "bg-surface-base text-text-primary border-border-muted hover:bg-surface-raised"
              }`}
            >
              <DietBadge diet="veg" size="sm" />
              <span>Veg</span>
            </button>

            {/* Non-Veg */}
            <button
              type="button"
              onClick={() => toggleDietFilter("nonveg")}
              aria-pressed={selectedDiets.includes("nonveg")}
              className={`min-h-[40px] px-3.5 py-1.5 rounded-pill text-xs font-extrabold inline-flex items-center gap-1.5 shrink-0 border transition duration-fast ${
                selectedDiets.includes("nonveg")
                  ? "bg-status-errorSoft text-nonveg border-nonveg ring-1 ring-nonveg"
                  : "bg-surface-base text-text-primary border-border-muted hover:bg-surface-raised"
              }`}
            >
              <DietBadge diet="nonveg" size="sm" />
              <span>Non-Veg</span>
            </button>

            {/* Egg */}
            <button
              type="button"
              onClick={() => toggleDietFilter("egg")}
              aria-pressed={selectedDiets.includes("egg")}
              className={`min-h-[40px] px-3.5 py-1.5 rounded-pill text-xs font-extrabold inline-flex items-center gap-1.5 shrink-0 border transition duration-fast ${
                selectedDiets.includes("egg")
                  ? "bg-status-warningSoft text-text-primary border-egg ring-1 ring-egg"
                  : "bg-surface-base text-text-primary border-border-muted hover:bg-surface-raised"
              }`}
            >
              <DietBadge diet="egg" size="sm" />
              <span>Egg</span>
            </button>

            {/* On Offer */}
            <button
              type="button"
              onClick={() => setOnOfferOnly((p) => !p)}
              aria-pressed={onOfferOnly}
              className={`min-h-[40px] px-3.5 py-1.5 rounded-pill text-xs font-extrabold inline-flex items-center gap-1.5 shrink-0 border transition duration-fast ${
                onOfferOnly
                  ? "bg-brand-primary text-text-onPrimary border-text-primary/20"
                  : "bg-surface-base text-text-primary border-border-muted hover:bg-surface-raised"
              }`}
            >
              <span>On Offer</span>
            </button>

            {/* Rated 4+ */}
            <button
              type="button"
              onClick={() => setRated4PlusOnly((p) => !p)}
              aria-pressed={rated4PlusOnly}
              className={`min-h-[40px] px-3.5 py-1.5 rounded-pill text-xs font-extrabold inline-flex items-center gap-1.5 shrink-0 border transition duration-fast ${
                rated4PlusOnly
                  ? "bg-brand-primary text-text-onPrimary border-text-primary/20"
                  : "bg-surface-base text-text-primary border-border-muted hover:bg-surface-raised"
              }`}
            >
              <span>Rated 4+ ★</span>
            </button>

            {/* Highly Ordered */}
            <button
              type="button"
              onClick={() => setHighlyOrderedOnly((p) => !p)}
              aria-pressed={highlyOrderedOnly}
              className={`min-h-[40px] px-3.5 py-1.5 rounded-pill text-xs font-extrabold inline-flex items-center gap-1.5 shrink-0 border transition duration-fast ${
                highlyOrderedOnly
                  ? "bg-brand-primary text-text-onPrimary border-text-primary/20"
                  : "bg-surface-base text-text-primary border-border-muted hover:bg-surface-raised"
              }`}
            >
              <span>Highly Ordered</span>
            </button>

            {/* Bestseller */}
            <button
              type="button"
              onClick={() => setBestsellerOnly((p) => !p)}
              aria-pressed={bestsellerOnly}
              className={`min-h-[40px] px-3.5 py-1.5 rounded-pill text-xs font-extrabold inline-flex items-center gap-1.5 shrink-0 border transition duration-fast ${
                bestsellerOnly
                  ? "bg-brand-primary text-text-onPrimary border-text-primary/20"
                  : "bg-surface-base text-text-primary border-border-muted hover:bg-surface-raised"
              }`}
            >
              <span>Bestseller</span>
            </button>

            {/* New */}
            <button
              type="button"
              onClick={() => setNewOnly((p) => !p)}
              aria-pressed={newOnly}
              className={`min-h-[40px] px-3.5 py-1.5 rounded-pill text-xs font-extrabold inline-flex items-center gap-1.5 shrink-0 border transition duration-fast ${
                newOnly
                  ? "bg-brand-primary text-text-onPrimary border-text-primary/20"
                  : "bg-surface-base text-text-primary border-border-muted hover:bg-surface-raised"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>New</span>
            </button>
          </div>
        </section>

        {/* 4. Main Layout: Left Category Sidebar (Desktop) + Right Menu Sections */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Category Sidebar (Desktop) */}
          <aside
            aria-label="Menu Categories"
            className="hidden lg:block lg:col-span-3 sticky top-20 rounded-md bg-surface-base border border-border-subtle shadow-card overflow-hidden"
          >
            <div className="bg-brand-secondary text-text-onSecondary px-4 py-3 flex items-center justify-between">
              <span className="text-sm font-extrabold uppercase tracking-wider">
                Menu Categories
              </span>
              <span className="text-xs font-bold text-brand-primary">
                {filteredItems.length} Items
              </span>
            </div>
            <ul className="divide-y divide-border-subtle">
              {categories.map((cat) => {
                const catItems = filteredItems.filter(
                  (i) => i.category_id === cat.id
                );
                const isActive = activeCategoryId === cat.id;
                const isExpanded = Boolean(expandedSidebarCat[cat.id]);

                return (
                  <li key={cat.id}>
                    <div className="flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => scrollToCategory(cat.id)}
                        className={`flex-1 min-h-[46px] px-4 py-2.5 text-left text-xs sm:text-sm font-bold flex items-center justify-between transition duration-fast ${
                          isActive
                            ? "bg-brand-primarySoft text-text-primary font-extrabold border-l-4 border-brand-secondary"
                            : "text-text-secondary hover:bg-surface-raised"
                        }`}
                      >
                        <span className="truncate pr-2">{cat.name}</span>
                        <span className="px-2 py-0.5 rounded-pill bg-surface-raised text-text-secondary text-xs font-extrabold">
                          {catItems.length}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setExpandedSidebarCat((prev) => ({
                            ...prev,
                            [cat.id]: !prev[cat.id],
                          }))
                        }
                        aria-label={`Expand ${cat.name} sub-list`}
                        className="p-2.5 text-text-muted hover:text-brand-secondary"
                      >
                        <Plus
                          className={`w-3.5 h-3.5 transition-transform ${
                            isExpanded ? "rotate-45 text-brand-secondary" : ""
                          }`}
                        />
                      </button>
                    </div>

                    {isExpanded && catItems.length > 0 && (
                      <ul className="bg-surface-raised px-4 py-2 space-y-1.5 border-t border-border-subtle">
                        {catItems.map((subItem) => (
                          <li key={subItem.id}>
                            <button
                              type="button"
                              onClick={() => setSelectedModalItem(subItem)}
                              className="w-full text-left text-xs font-medium text-text-secondary hover:text-brand-secondary truncate flex items-center gap-1.5 py-0.5"
                            >
                              <ChevronRight className="w-3 h-3 shrink-0" />
                              <span className="truncate">{subItem.name}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          </aside>

          {/* Right Category & Item Cards Grid */}
          <div className="lg:col-span-9 space-y-8">
            {filteredItems.length === 0 ? (
              <div className="p-10 rounded-md bg-surface-base border border-border-subtle text-center space-y-3 shadow-card">
                <p className="text-base font-extrabold text-text-primary">
                  No menu items match your current filters
                </p>
                <p className="text-xs text-text-secondary">
                  Try clearing &ldquo;In Stock&rdquo; or dietary filters to view
                  all 10 Burger Budds specialties.
                </p>
                <button
                  type="button"
                  onClick={resetAllFilters}
                  className="min-h-[44px] px-5 py-2 rounded-xs bg-brand-primary text-text-onPrimary font-extrabold text-xs shadow-1"
                >
                  Reset All Filters
                </button>
              </div>
            ) : (
              categories.map((cat) => {
                const catItems = filteredItems.filter(
                  (i) => i.category_id === cat.id
                );
                if (catItems.length === 0) return null;

                return (
                  <section
                    key={cat.id}
                    id={`cat-section-${cat.id}`}
                    className="scroll-mt-24 space-y-3.5"
                  >
                    {/* Category Header: Uppercase Title + "N items" Right Aligned */}
                    <div className="flex items-center justify-between border-b-2 border-brand-secondary/20 pb-2">
                      <h2 className="text-base sm:text-lg font-extrabold uppercase tracking-wide text-text-primary">
                        {cat.name}
                      </h2>
                      <span className="text-xs sm:text-sm font-extrabold text-text-secondary">
                        {catItems.length}{" "}
                        {catItems.length === 1 ? "item" : "items"}
                      </span>
                    </div>

                    {/* 2 Columns on Desktop, 1 Column on Mobile */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {catItems.map((item) => (
                        <MenuItemCard
                          key={item.id}
                          item={item}
                          onSelectItem={(it) => setSelectedModalItem(it)}
                        />
                      ))}
                    </div>
                  </section>
                );
              })
            )}
          </div>
        </div>
      </main>

      {/* Mobile Bottom Dock: Search Field + Black "Menu" Button */}
      <div
        className={`fixed left-0 right-0 z-30 lg:hidden px-3 transition-all ${
          totalItemsCount > 0 ? "bottom-16" : "bottom-3"
        }`}
      >
        <div className="max-w-md mx-auto flex items-center gap-2 bg-surface-base/95 backdrop-blur-xs p-1.5 rounded-pill shadow-floating border border-border-muted">
          <div className="flex-1 flex items-center pl-3 pr-2 h-10">
            <Search className="w-4 h-4 text-text-muted mr-2 shrink-0" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Search menu (${items.length} items)...`}
              aria-label="Search menu on mobile"
              className="w-full bg-transparent text-xs font-semibold text-text-primary focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                aria-label="Clear search"
                className="p-1 text-text-muted"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => setShowMobileCategoryModal(true)}
            className="min-h-[40px] px-4 rounded-pill bg-surface-dark text-text-onSecondary font-extrabold text-xs inline-flex items-center gap-1.5 shrink-0"
          >
            <Utensils className="w-3.5 h-3.5 text-brand-primary" />
            <span>Menu</span>
          </button>
        </div>
      </div>

      {/* Mobile Category Modal */}
      {showMobileCategoryModal && (
        <div
          className="fixed inset-0 z-50 lg:hidden flex items-end justify-center"
          role="dialog"
          aria-modal="true"
          aria-label="Menu Categories"
        >
          <div
            className="fixed inset-0 bg-surface-dark/60"
            onClick={() => setShowMobileCategoryModal(false)}
          />
          <div className="relative z-10 w-full max-w-md rounded-t-md bg-surface-base text-text-primary p-5 shadow-floating space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-border-subtle">
              <h3 className="text-base font-extrabold uppercase">
                Browse Categories
              </h3>
              <button
                type="button"
                onClick={() => setShowMobileCategoryModal(false)}
                className="p-2 text-text-secondary"
                aria-label="Close categories modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <ul className="divide-y divide-border-subtle max-h-72 overflow-y-auto">
              {categories.map((cat) => {
                const count = filteredItems.filter(
                  (i) => i.category_id === cat.id
                ).length;
                return (
                  <li key={cat.id}>
                    <button
                      type="button"
                      onClick={() => scrollToCategory(cat.id)}
                      className="w-full min-h-[44px] py-2.5 flex items-center justify-between text-sm font-bold text-text-primary"
                    >
                      <span>{cat.name}</span>
                      <span className="px-2.5 py-0.5 rounded-pill bg-brand-primary text-text-onPrimary text-xs font-extrabold">
                        {count}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}

      {/* Sticky View Cart Bar: Desktop Floating Pill / Mobile Full-Width Yellow Bar */}
      {totalItemsCount > 0 && (
        <div className="fixed bottom-0 inset-x-0 z-40 lg:bottom-5 lg:inset-x-auto lg:right-8">
          <Link
            href={`/checkout/${cartId}`}
            className="w-full lg:w-auto lg:min-w-[340px] min-h-[54px] px-6 py-3 lg:rounded-pill bg-brand-primary hover:bg-brand-primaryHover text-text-onPrimary font-extrabold text-sm sm:text-base flex items-center justify-between gap-6 shadow-floating border-t lg:border-2 border-text-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary transition duration-fast"
          >
            <div className="flex items-center gap-2.5">
              <ShoppingBag className="w-5 h-5" />
              <span>
                View Cart • {totalItemsCount}{" "}
                {totalItemsCount === 1 ? "Item" : "Items"} | ₹{cartSubtotal}
              </span>
            </div>
            <span className="inline-flex items-center gap-1 text-xs sm:text-sm font-extrabold uppercase tracking-wide bg-surface-dark text-text-onSecondary px-3 py-1 rounded-pill">
              Checkout →
            </span>
          </Link>
        </div>
      )}

      {/* Item Customization Modal */}
      <ItemDetailModal
        item={selectedModalItem}
        onClose={() => setSelectedModalItem(null)}
      />

      <GlobalFooter />
    </div>
  );
}
