"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  ChevronRight,
  Coins,
  Gift,
  HelpCircle,
  LifeBuoy,
  LogOut,
  MapPin,
  Package,
  RefreshCcw,
  User,
  X,
} from "lucide-react";
import { useApp } from "@/context/AppContext";
import { OrderRecord } from "@/types/database";

export function ProfileDrawer() {
  const {
    user,
    isProfileOpen,
    profileSection,
    openProfile,
    closeProfile,
    updateUserProfile,
    logout,
    openAddressModal,
  } = useApp();

  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [nameInput, setNameInput] = useState(user?.name || "");
  const [emailInput, setEmailInput] = useState(user?.email || "");
  const [concernText, setConcernText] = useState("");
  const [concernSent, setConcernSent] = useState(false);

  useEffect(() => {
    if (user) {
      setNameInput(user.name);
      setEmailInput(user.email);
    }
  }, [user]);

  useEffect(() => {
    if (isProfileOpen && profileSection === "orders") {
      fetch("/api/orders")
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data.orders)) setOrders(data.orders);
        })
        .catch(() => {});
    }
  }, [isProfileOpen, profileSection]);

  if (!isProfileOpen || !user) return null;

  const menuItems = [
    { id: "personal", label: "Personal Information", icon: User },
    { id: "orders", label: "My Orders", icon: Package },
    { id: "refer", label: "Refer and Earn", icon: Gift },
    {
      id: "coins",
      label: `BB Coins (Wallet: ${user.wallet_balance})`,
      icon: Coins,
    },
    { id: "addresses", label: "Manage Addresses", icon: MapPin },
    { id: "faqs", label: "FAQs", icon: HelpCircle },
    { id: "refund", label: "How to track my Refund?", icon: RefreshCcw },
    { id: "concern", label: "Raise a Concern", icon: LifeBuoy },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-label="Customer Profile Menu"
    >
      <div
        className="fixed inset-0 bg-surface-dark/60 backdrop-blur-xs"
        onClick={closeProfile}
      />

      <div className="relative z-10 w-full max-w-md bg-surface-base text-text-primary h-full flex flex-col justify-between shadow-floating overflow-y-auto">
        <div>
          {/* Top Green Profile Header */}
          <div className="bg-brand-secondary text-text-onSecondary p-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-pill bg-brand-primary text-text-onPrimary font-extrabold text-lg flex items-center justify-center shadow-1">
                {user.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()}
              </div>
              <div>
                <h2 className="text-base font-extrabold">{user.name}</h2>
                <p className="text-xs text-text-onSecondary/85">{user.phone}</p>
                <p className="text-xs text-brand-primary font-bold">
                  {user.email}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={closeProfile}
              aria-label="Close profile menu"
              className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xs text-text-onSecondary hover:bg-brand-secondaryDark"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation or Active Sub-section */}
          {profileSection === "overview" ? (
            <ul className="divide-y divide-border-subtle">
              {menuItems.map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => {
                        if (item.id === "addresses") {
                          closeProfile();
                          openAddressModal();
                        } else {
                          openProfile(item.id);
                        }
                      }}
                      className="w-full min-h-[52px] px-5 py-3 flex items-center justify-between text-left hover:bg-surface-raised transition duration-fast"
                    >
                      <div className="flex items-center gap-3">
                        <Icon className="w-4 h-4 text-brand-secondary" />
                        <span className="text-sm font-bold text-text-primary">
                          {item.label}
                        </span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-text-muted" />
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="p-5 space-y-4">
              <button
                type="button"
                onClick={() => openProfile("overview")}
                className="text-xs font-extrabold text-brand-secondary underline"
              >
                ← Back to Profile Menu
              </button>

              {profileSection === "personal" && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    updateUserProfile({ name: nameInput, email: emailInput });
                    openProfile("overview");
                  }}
                  className="space-y-3"
                >
                  <h3 className="text-base font-extrabold">
                    Personal Information
                  </h3>
                  <div>
                    <label className="block text-xs font-bold text-text-secondary mb-1">
                      Full Name
                    </label>
                    <input
                      type="text"
                      value={nameInput}
                      onChange={(e) => setNameInput(e.target.value)}
                      className="w-full min-h-[44px] px-3 rounded-xs border border-border-muted text-sm font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-text-secondary mb-1">
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      className="w-full min-h-[44px] px-3 rounded-xs border border-border-muted text-sm font-medium"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full min-h-[44px] rounded-xs bg-brand-primary text-text-onPrimary font-extrabold text-sm"
                  >
                    Save Profile Changes
                  </button>
                </form>
              )}

              {profileSection === "orders" && (
                <div className="space-y-3">
                  <h3 className="text-base font-extrabold">My Orders</h3>
                  {orders.length === 0 ? (
                    <p className="text-xs text-text-secondary">
                      No orders placed yet.
                    </p>
                  ) : (
                    orders.map((ord) => (
                      <div
                        key={ord.id}
                        className="p-3.5 rounded-xs border border-border-subtle bg-surface-raised space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-extrabold text-brand-secondary">
                            {ord.order_no}
                          </span>
                          <span className="px-2 py-0.5 rounded-pill bg-brand-primary text-text-onPrimary text-[11px] font-extrabold uppercase">
                            {ord.status.replace(/_/g, " ")}
                          </span>
                        </div>
                        <p className="text-xs font-semibold text-text-primary">
                          {ord.items
                            .map((i) => `${i.qty}x ${i.item_name}`)
                            .join(", ")}
                        </p>
                        <div className="flex items-center justify-between pt-1 border-t border-border-subtle">
                          <span className="text-xs font-extrabold">
                            Total: ₹{ord.grand_total}
                          </span>
                          <Link
                            href={`/track/${ord.id}`}
                            onClick={closeProfile}
                            className="text-xs font-extrabold text-brand-secondary underline"
                          >
                            Track Live →
                          </Link>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {profileSection === "refer" && (
                <div className="p-4 rounded-sm bg-surface-raised border border-border-subtle space-y-2">
                  <h3 className="text-base font-extrabold">Refer and Earn</h3>
                  <p className="text-xs text-text-secondary">
                    Share your code with friends in Gwalior! They get ₹50 off
                    their first burger order, and you earn 75 BB Coins.
                  </p>
                  <div className="p-3 rounded-xs bg-brand-secondary text-brand-primary font-extrabold text-center tracking-widest text-base">
                    {user.referral_code}
                  </div>
                </div>
              )}

              {profileSection === "coins" && (
                <div className="p-4 rounded-sm bg-brand-primarySoft border border-brand-primary space-y-2">
                  <h3 className="text-base font-extrabold">
                    BB Coins Wallet Balance
                  </h3>
                  <p className="text-2xl font-extrabold text-brand-secondary">
                    {user.wallet_balance} BB Coins (₹{user.wallet_balance})
                  </p>
                  <p className="text-xs text-text-secondary">
                    1 BB Coin = ₹1. Toggle &ldquo;Use Wallet Balance&rdquo; at
                    checkout to get instant savings!
                  </p>
                </div>
              )}

              {profileSection === "faqs" && (
                <div className="space-y-3 text-xs">
                  <h3 className="text-base font-extrabold">FAQs</h3>
                  <div>
                    <p className="font-bold text-text-primary">
                      How fast does Burger Budds deliver in Gwalior?
                    </p>
                    <p className="text-text-secondary">
                      Within our 5 km radius around Vinay Nagar, we deliver hot
                      & crispy burgers in 30–45 minutes.
                    </p>
                  </div>
                  <div>
                    <p className="font-bold text-text-primary">
                      Can I cancel my order?
                    </p>
                    <p className="text-text-secondary">
                      Yes, you can cancel while the order status is
                      &ldquo;Placed&rdquo; before the kitchen accepts it.
                    </p>
                  </div>
                </div>
              )}

              {profileSection === "refund" && (
                <div className="space-y-2 text-xs">
                  <h3 className="text-base font-extrabold">
                    How to track my Refund?
                  </h3>
                  <p className="text-text-secondary">
                    For cancelled or rejected prepaid orders, refunds are
                    initiated automatically within 2 hours and reflect in your
                    source UPI/Card account within 3–5 business days, or
                    instantly if credited to BB Coins.
                  </p>
                </div>
              )}

              {profileSection === "concern" && (
                <div className="space-y-3">
                  <h3 className="text-base font-extrabold">Raise a Concern</h3>
                  {concernSent ? (
                    <div className="p-3 rounded-xs bg-status-openSoft text-status-open text-xs font-bold">
                      Thank you! Our Gwalior store manager will call you within
                      15 minutes.
                    </div>
                  ) : (
                    <>
                      <textarea
                        rows={3}
                        value={concernText}
                        onChange={(e) => setConcernText(e.target.value)}
                        placeholder="Describe your issue with an order or item..."
                        className="w-full p-3 rounded-xs border border-border-muted text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => setConcernSent(true)}
                        className="w-full min-h-[44px] rounded-xs bg-brand-primary text-text-onPrimary font-extrabold text-xs"
                      >
                        Send Feedback to Store Manager
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bottom Logout Button */}
        <div className="p-5 border-t border-border-subtle">
          <button
            type="button"
            onClick={logout}
            className="w-full min-h-[44px] rounded-xs bg-status-errorSoft hover:bg-status-error text-status-error hover:text-text-onSecondary font-extrabold text-sm flex items-center justify-center gap-2 transition duration-fast"
          >
            <LogOut className="w-4 h-4" />
            <span>Logout</span>
          </button>
        </div>
      </div>
    </div>
  );
}
