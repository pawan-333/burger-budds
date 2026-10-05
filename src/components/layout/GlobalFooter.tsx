"use client";

import React from "react";
import Link from "next/link";
import { MapPin, Phone, ShieldCheck, Store } from "lucide-react";
import { DEFAULT_OUTLET_SLUG, SEED_OUTLET } from "@/lib/seed-data";

export function GlobalFooter() {
  return (
    <footer className="bg-brand-secondary text-text-onSecondary mt-16 border-t border-text-onSecondary/15">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 grid grid-cols-1 md:grid-cols-4 gap-8">
        {/* Column 1: Brand */}
        <div className="space-y-3">
          <div className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.png"
              alt="Burger Budds"
              loading="lazy"
              decoding="async"
              className="h-11 w-auto object-contain"
            />
            <div>
              <p className="text-lg font-extrabold text-brand-primary leading-none">
                BURGER BUDDS
              </p>
              <p className="text-xs text-text-onSecondary/85">
                Handcrafted Smash Burgers & Shakes
              </p>
            </div>
          </div>
          <p className="text-xs text-text-onSecondary/85 leading-relaxed">
            Serving Gwalior&apos;s crunchiest smash burgers, peri-peri crinkle
            fries, and thick Belgian chocolate shakes hot & fresh to your
            doorstep.
          </p>
          <div className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-primary">
            <ShieldCheck className="w-4 h-4" />
            <span>FSSAI Lic. No. 21424010001892</span>
          </div>
        </div>

        {/* Column 2: Quick Links */}
        <div className="space-y-2.5">
          <h3 className="text-sm font-extrabold uppercase tracking-wider text-brand-primary">
            Explore Burger Budds
          </h3>
          <ul className="space-y-2 text-xs font-semibold">
            <li>
              <Link
                href={`/order/${DEFAULT_OUTLET_SLUG}`}
                className="hover:underline"
              >
                Order Online Menu
              </Link>
            </li>
            <li>
              <Link href="/about" className="hover:underline">
                About Us
              </Link>
            </li>
            <li>
              <Link href="/stores" className="hover:underline">
                Store Locator (Gwalior)
              </Link>
            </li>
            <li>
              <Link href="/gallery" className="hover:underline">
                Food & Store Gallery
              </Link>
            </li>
            <li>
              <Link href="/track" className="hover:underline">
                Track Live Order
              </Link>
            </li>
          </ul>
        </div>

        {/* Column 3: Policies & Help */}
        <div className="space-y-2.5">
          <h3 className="text-sm font-extrabold uppercase tracking-wider text-brand-primary">
            Policies & Support
          </h3>
          <ul className="space-y-2 text-xs font-semibold">
            <li>
              <Link href="/faqs" className="hover:underline">
                Frequently Asked Questions
              </Link>
            </li>
            <li>
              <Link href="/terms" className="hover:underline">
                Terms & Conditions
              </Link>
            </li>
            <li>
              <Link href="/privacy" className="hover:underline">
                Privacy Policy
              </Link>
            </li>
            <li>
              <Link href="/refund-policy" className="hover:underline">
                Refund & Cancellation Policy
              </Link>
            </li>
            <li>
              <Link
                href="/merchant"
                className="inline-flex items-center gap-1 text-brand-primary font-extrabold hover:underline"
              >
                <Store className="w-3.5 h-3.5" />
                Merchant Partner App (PWA)
              </Link>
            </li>
          </ul>
        </div>

        {/* Column 4: Flagship Outlet */}
        <div className="space-y-2.5">
          <h3 className="text-sm font-extrabold uppercase tracking-wider text-brand-primary">
            Flagship Gwalior Outlet
          </h3>
          <p className="text-xs flex items-start gap-2 text-text-onSecondary/90">
            <MapPin className="w-4 h-4 text-brand-primary shrink-0 mt-0.5" />
            <span>{SEED_OUTLET.address}</span>
          </p>
          <p className="text-xs flex items-center gap-2 text-text-onSecondary/90">
            <Phone className="w-4 h-4 text-brand-primary shrink-0" />
            <span>{SEED_OUTLET.phone}</span>
          </p>
          <p className="text-xs text-text-onSecondary/80">
            Open Daily: {SEED_OUTLET.timings.open} – {SEED_OUTLET.timings.close}
          </p>
        </div>
      </div>

      <div className="border-t border-text-onSecondary/15 py-4 text-center text-xs text-text-onSecondary/80">
        © {new Date().getFullYear()} Burger Budds Hospitality. Crafted with
        fresh ingredients in Gwalior.
      </div>
    </footer>
  );
}
