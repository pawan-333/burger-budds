import React from "react";
import Link from "next/link";
import { Clock, MapPin, Phone, Utensils } from "lucide-react";
import { GlobalHeader } from "@/components/layout/GlobalHeader";
import { GlobalFooter } from "@/components/layout/GlobalFooter";
import { DEFAULT_OUTLET_SLUG, SEED_OUTLET } from "@/lib/seed-data";

export default function StoreLocatorPage() {
  return (
    <div className="min-h-screen flex flex-col bg-surface-page text-text-primary">
      <GlobalHeader />
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-10 space-y-6">
        <div>
          <h1 className="text-2xl font-extrabold text-text-primary">
            Burger Budds Store Locator
          </h1>
          <p className="text-xs sm:text-sm text-text-secondary">
            Find our outlets in Gwalior for hot doorstep delivery or self-pickup
            takeaway.
          </p>
        </div>

        <article className="rounded-md bg-surface-base border border-border-subtle p-6 shadow-card flex flex-col md:flex-row justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-pill bg-status-open text-text-onSecondary text-xs font-extrabold">
                OPEN NOW
              </span>
              <span className="text-xs font-bold text-brand-secondary">
                Flagship Outlet • 5 km Delivery Radius
              </span>
            </div>
            <h2 className="text-lg font-extrabold">{SEED_OUTLET.name}</h2>
            <p className="text-xs sm:text-sm text-text-secondary flex items-start gap-2">
              <MapPin className="w-4 h-4 text-brand-secondary shrink-0 mt-0.5" />
              <span>{SEED_OUTLET.address}</span>
            </p>
            <p className="text-xs sm:text-sm text-text-secondary flex items-center gap-2">
              <Clock className="w-4 h-4 text-brand-secondary shrink-0" />
              <span>
                Daily: {SEED_OUTLET.timings.open} – {SEED_OUTLET.timings.close}
              </span>
            </p>
            <div className="pt-2 flex flex-wrap gap-3">
              <Link
                href={`/order/${DEFAULT_OUTLET_SLUG}`}
                className="min-h-[44px] px-5 py-2 rounded-xs bg-brand-primary hover:bg-brand-primaryHover text-text-onPrimary font-extrabold text-xs sm:text-sm inline-flex items-center gap-2 shadow-1"
              >
                <Utensils className="w-4 h-4" />
                <span>Order Online from This Outlet</span>
              </Link>
              <a
                href={`tel:${SEED_OUTLET.phone}`}
                className="min-h-[44px] px-4 py-2 rounded-xs bg-brand-secondary text-text-onSecondary font-bold text-xs sm:text-sm inline-flex items-center gap-2"
              >
                <Phone className="w-4 h-4 text-brand-primary" />
                <span>Call {SEED_OUTLET.phone}</span>
              </a>
            </div>
          </div>
        </article>
      </main>
      <GlobalFooter />
    </div>
  );
}
