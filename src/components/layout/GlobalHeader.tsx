"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  MapPin,
  Menu,
  Mic,
  MicOff,
  Phone,
  Search,
  ShoppingBag,
  Smartphone,
  Store,
  Truck,
  User,
  X,
} from "lucide-react";
import { useApp } from "@/context/AppContext";
import { DEFAULT_OUTLET_SLUG } from "@/lib/seed-data";

interface GlobalHeaderProps {
  totalMenuItems?: number;
}

export function GlobalHeader({ totalMenuItems = 10 }: GlobalHeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const {
    cartId,
    totalItemsCount,
    cartSubtotal,
    user,
    openAuthModal,
    openProfile,
    selectedAddress,
    openAddressModal,
    searchQuery,
    setSearchQuery,
  } = useApp();

  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceMessage, setVoiceMessage] = useState<string | null>(null);

  useEffect(() => {
    setMobileDrawerOpen(false);
  }, [pathname]);

  const handleVoiceSearch = () => {
    if (typeof window === "undefined") return;
    const SpeechRecognitionAPI =
      (window as unknown as Record<string, unknown>).SpeechRecognition ||
      (window as unknown as Record<string, unknown>).webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) {
      setVoiceMessage("Voice search is not supported in this browser.");
      setTimeout(() => setVoiceMessage(null), 3000);
      return;
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const recognition = new (SpeechRecognitionAPI as any)();
      recognition.lang = "en-IN";
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      setIsListening(true);
      setVoiceMessage("Listening... Speak a burger or side name");

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onresult = (event: any) => {
        const transcript = event.results?.[0]?.[0]?.transcript || "";
        setSearchQuery(transcript);
        setIsListening(false);
        setVoiceMessage(null);
        if (!pathname.startsWith("/order")) {
          router.push(`/order/${DEFAULT_OUTLET_SLUG}`);
        }
      };

      recognition.onerror = () => {
        setIsListening(false);
        setVoiceMessage("Could not hear clearly. Try typing or tap mic again.");
        setTimeout(() => setVoiceMessage(null), 3000);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
    } catch {
      setIsListening(false);
    }
  };

  const navLinks = [
    { href: "/", label: "Home" },
    { href: "/about", label: "About Us" },
    { href: "/stores", label: "Store Locator" },
    { href: `/order/${DEFAULT_OUTLET_SLUG}`, label: "Order Now" },
    { href: "/gallery", label: "Gallery" },
  ];

  return (
    <header className="sticky top-0 z-40 bg-brand-secondary text-text-onSecondary shadow-card">
      {/* Main Top Bar */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 h-16 flex items-center justify-between gap-3">
        {/* Mobile Hamburger */}
        <div className="flex items-center gap-2 lg:hidden">
          <button
            type="button"
            onClick={() => setMobileDrawerOpen(true)}
            className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xs text-text-onSecondary hover:bg-brand-secondaryDark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 focus-visible:ring-offset-brand-secondary transition duration-fast"
            aria-label="Open navigation menu"
          >
            <Menu className="w-6 h-6" />
          </button>
        </div>

        {/* Brand Logo */}
        <Link
          href={`/order/${DEFAULT_OUTLET_SLUG}`}
          className="flex items-center gap-2.5 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary rounded-xs py-1"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt="Burger Budds Logo"
            className="h-10 sm:h-11 w-auto object-contain drop-shadow"
          />
          <div className="hidden sm:flex flex-col">
            <span className="text-lg font-extrabold tracking-tight leading-none text-brand-primary">
              BURGER BUDDS
            </span>
            <span className="text-[11px] font-medium text-text-onSecondary opacity-90">
              Fresh Smash & Crunch • Gwalior
            </span>
          </div>
        </Link>

        {/* Desktop Search Bar with Voice Mic */}
        <div className="hidden lg:flex flex-1 max-w-xl mx-4 relative">
          <div className="w-full flex items-center bg-surface-base text-text-primary rounded-pill px-4 h-11 shadow-1 border border-border-subtle focus-within:ring-2 focus-within:ring-brand-primary">
            <Search className="w-4 h-4 text-text-muted shrink-0 mr-2.5" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (!pathname.startsWith("/order")) {
                  router.push(`/order/${DEFAULT_OUTLET_SLUG}`);
                }
              }}
              placeholder={`Search this outlet's menu — ${totalMenuItems} items`}
              aria-label="Search this outlet's menu"
              className="w-full bg-transparent text-sm font-medium text-text-primary placeholder:text-text-muted focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                aria-label="Clear search query"
                className="p-1 text-text-muted hover:text-text-primary"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={handleVoiceSearch}
              aria-label={
                isListening ? "Listening for voice search" : "Search by voice"
              }
              title="Voice Search"
              className={`ml-1 min-h-[36px] min-w-[36px] rounded-pill inline-flex items-center justify-center transition duration-fast ${
                isListening
                  ? "bg-status-error text-text-onSecondary animate-pulse"
                  : "hover:bg-surface-raised text-brand-secondary"
              }`}
            >
              {isListening ? (
                <MicOff className="w-4 h-4" />
              ) : (
                <Mic className="w-4 h-4" />
              )}
            </button>
          </div>
          {voiceMessage && (
            <div
              role="status"
              className="absolute left-0 right-0 -bottom-9 bg-surface-dark text-text-onSecondary text-xs font-semibold px-3 py-1.5 rounded-xs shadow-floating text-center"
            >
              {voiceMessage}
            </div>
          )}
        </div>

        {/* Right Actions (Desktop + Mobile Icons) */}
        <div className="flex items-center gap-1.5 sm:gap-3">
          {/* Address Quick Button */}
          <button
            type="button"
            onClick={openAddressModal}
            className="min-h-[44px] px-2.5 py-1.5 rounded-xs inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-text-onSecondary hover:bg-brand-secondaryDark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary transition duration-fast"
            aria-label="Select delivery address"
          >
            <MapPin className="w-4 h-4 text-brand-primary shrink-0" />
            <span className="hidden xl:inline max-w-[140px] truncate">
              {selectedAddress
                ? `${selectedAddress.label.toUpperCase()}: ${selectedAddress.locality}`
                : "Set Location"}
            </span>
          </button>

          {/* Track Order Link */}
          <Link
            href="/track/ord-demo-1001"
            className="hidden md:inline-flex min-h-[44px] px-3 py-2 rounded-xs items-center gap-1.5 text-sm font-bold text-text-onSecondary hover:bg-brand-secondaryDark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary transition duration-fast"
          >
            <Truck className="w-4 h-4 text-brand-primary" />
            <span>Track</span>
          </Link>

          {/* Login / Profile */}
          {user && <button
            type="button"
            onClick={() => (user ? openProfile("overview") : openAuthModal())}
            className="min-h-[44px] px-2.5 sm:px-3 py-2 rounded-xs inline-flex items-center gap-1.5 text-sm font-bold text-text-onSecondary hover:bg-brand-secondaryDark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary transition duration-fast"
            aria-label={user ? "Open profile menu" : "Login or Sign up"}
          >
            <User className="w-4 h-4 text-brand-primary" />
            <span className="hidden sm:inline max-w-[110px] truncate">
              {user ? user.name.split(" ")[0] : "Login"}
            </span>
          </button>}

          {/* Cart Button (Yellow with Dark Text & Badge) */}
          <Link
            href={`/checkout/${cartId}`}
            className="min-h-[44px] px-3.5 py-2 rounded-xs bg-brand-primary hover:bg-brand-primaryHover active:scale-[0.98] text-text-onPrimary font-extrabold text-sm inline-flex items-center gap-2 shadow-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary focus-visible:ring-offset-2 transition duration-fast"
            aria-label={`Cart with ${totalItemsCount} items`}
          >
            <ShoppingBag className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">Cart</span>
            <span className="px-2 py-0.5 text-xs font-extrabold rounded-pill bg-surface-dark text-text-onSecondary">
              {totalItemsCount}
            </span>
            {cartSubtotal > 0 && (
              <span className="hidden md:inline text-xs font-bold border-l border-text-primary/20 pl-2">
                ₹{cartSubtotal}
              </span>
            )}
          </Link>
        </div>
      </div>

      {/* Sub-navigation Row (Desktop) */}
      <nav
        aria-label="Secondary navigation"
        className="hidden lg:block bg-brand-secondaryDark border-t border-text-onSecondary/10"
      >
        <div className="max-w-7xl mx-auto px-6 h-11 flex items-center justify-between text-xs font-bold tracking-wide">
          <ul className="flex items-center gap-6">
            {navLinks.map((link) => {
              const isActive =
                link.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(link.href);
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className={`py-2 inline-flex items-center border-b-2 transition duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary ${
                      isActive
                        ? "border-brand-primary text-brand-primary text-sm"
                        : "border-transparent text-text-onSecondary hover:text-brand-primary"
                    }`}
                  >
                    {link.label}
                  </Link>
                </li>
              );
            })}
          </ul>

          <div className="flex items-center gap-4">
            <Link
              href="/merchant"
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-pill bg-brand-primary text-text-onPrimary font-extrabold text-xs hover:bg-brand-primaryHover transition duration-fast"
            >
              <Store className="w-3.5 h-3.5" />
              <span>Merchant App (Live POS)</span>
            </Link>
            <a
              href="tel:+919826012345"
              className="inline-flex items-center gap-1.5 text-text-onSecondary hover:underline"
            >
              <Phone className="w-3.5 h-3.5 text-brand-primary" />
              <span>+91 98260 12345</span>
            </a>
          </div>
        </div>
      </nav>

      {/* Mobile Navigation Drawer */}
      {mobileDrawerOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden flex"
          role="dialog"
          aria-modal="true"
          aria-label="Mobile Navigation Drawer"
        >
          <div
            className="fixed inset-0 bg-surface-dark/60 backdrop-blur-xs"
            onClick={() => setMobileDrawerOpen(false)}
          />
          <div className="relative w-80 max-w-[85vw] bg-brand-secondary text-text-onSecondary h-full flex flex-col justify-between p-5 z-10 shadow-floating overflow-y-auto">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-text-onSecondary/15">
                <div className="flex items-center gap-2.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/logo.png"
                    alt="Burger Budds"
                    className="h-10 w-auto object-contain"
                  />
                  <span className="text-lg font-extrabold text-brand-primary">
                    BURGER BUDDS
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileDrawerOpen(false)}
                  className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xs text-text-onSecondary hover:bg-brand-secondaryDark"
                  aria-label="Close navigation menu"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <ul className="mt-4 space-y-1">
                {navLinks.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="min-h-[44px] px-3 py-2.5 rounded-xs flex items-center text-base font-bold text-text-onSecondary hover:bg-brand-secondaryDark"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
                <li>
                  <Link
                    href="/track/ord-demo-1001"
                    className="min-h-[44px] px-3 py-2.5 rounded-xs flex items-center gap-2 text-base font-bold text-text-onSecondary hover:bg-brand-secondaryDark"
                  >
                    <Truck className="w-4 h-4 text-brand-primary" />
                    <span>Track Live Order</span>
                  </Link>
                </li>
                <li>
                  <Link
                    href="/merchant"
                    className="min-h-[44px] px-3 py-2.5 rounded-xs flex items-center gap-2 text-base font-bold text-brand-primary hover:bg-brand-secondaryDark"
                  >
                    <Store className="w-4 h-4" />
                    <span>Merchant App (PWA)</span>
                  </Link>
                </li>
              </ul>
            </div>

            <div className="pt-6 border-t border-text-onSecondary/15 space-y-3">
              <Link
                href={`/order/${DEFAULT_OUTLET_SLUG}`}
                className="w-full min-h-[44px] rounded-xs border-2 border-text-onSecondary text-text-onSecondary font-bold text-sm flex items-center justify-center hover:bg-brand-secondaryDark transition duration-fast"
              >
                Order Online
              </Link>
              <Link
                href="/merchant"
                className="w-full min-h-[44px] rounded-xs bg-brand-primary text-text-onPrimary font-extrabold text-sm flex items-center justify-center gap-2 shadow-1 hover:bg-brand-primaryHover transition duration-fast"
              >
                <Smartphone className="w-4 h-4" />
                <span>Download The App</span>
              </Link>
              <a
                href="tel:+919826012345"
                className="w-full min-h-[44px] rounded-xs bg-brand-secondaryDark text-text-onSecondary font-semibold text-sm flex items-center justify-center gap-2"
              >
                <Phone className="w-4 h-4 text-brand-primary" />
                <span>Outlet Support: +91 98260 12345</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
